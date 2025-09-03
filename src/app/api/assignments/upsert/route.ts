import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseClient';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getPlanner } from '@/services/planner.service';
import { listStaff } from '@/services/staff.service';
import { getAssignmentsByMonth } from '@/services/assignment.service';
import { daysIn } from '@/lib/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT';
const SHIFTS: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];
const SORT_ORDER: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];
const sortShift = (a: ShiftType, b: ShiftType) => SORT_ORDER.indexOf(a) - SORT_ORDER.indexOf(b);

function isValidYm(ym: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}
const key = (day: number, shift: ShiftType) => `${day}-${shift}`;

export async function POST(req: NextRequest) {
  try {
    const { wid, ym, day, shift, staffIds } = (await req.json()) as {
      wid: string;
      ym: string;
      day: number;
      shift: ShiftType;
      staffIds: string[];
    };

    // --------- validate basic ---------
    if (!wid) return NextResponse.json({ ok: false, error: 'wid is required' }, { status: 400 });
    if (!ym || !isValidYm(ym)) return NextResponse.json({ ok: false, error: 'ym must be YYYY-MM' }, { status: 400 });
    if (!Number.isInteger(day) || day <= 0 || day > daysIn(ym)) {
      return NextResponse.json({ ok: false, error: 'day out of range' }, { status: 400 });
    }
    if (!SHIFTS.includes(shift)) {
      return NextResponse.json({ ok: false, error: 'shift must be MORNING/AFTERNOON/NIGHT' }, { status: 400 });
    }
    if (!Array.isArray(staffIds)) {
      return NextResponse.json({ ok: false, error: 'staffIds must be array' }, { status: 400 });
    }

    // --------- load references ---------
    const [planner, allStaff, monthAssignments] = await Promise.all([
      getPlanner(wid, ym),
      listStaff(wid),
      getAssignmentsByMonth(wid, ym),
    ]);

    // policy: skip last night
    if (planner?.skipLastNight && shift === 'NIGHT' && day === daysIn(ym)) {
      return NextResponse.json({ ok: false, error: 'เวรดึกของวันสุดท้ายถูกปิดในแผน (skipLastNight)' }, { status: 409 });
    }

    // role map + filter staff existing
    const staffMap: Record<string, { id: string; name: string; role: 'INCHARGE' | 'MED'; active?: boolean }> = {};
    for (const s of allStaff) {
      if (s.role === 'INCHARGE' || s.role === 'MED') {
        staffMap[s.id] = { id: s.id, name: s.name, role: s.role, active: s.active };
      }
    }

    // sanitize staffIds (unique + only known staff)
    const unique = Array.from(new Set(staffIds)).filter((id) => !!staffMap[id]);

    // planner numbers
    const demand = planner?.demand?.[shift] ?? 0;
    const inMin = Math.max(1, planner?.inchargeMinPerShift ?? 1);
    const inMax = Math.max(inMin, planner?.inchargeMaxPerShift ?? 2);

    // slot-level violations used by UI badges
    const icCount = unique.filter((id) => staffMap[id]?.role === 'INCHARGE').length;
    const violations: Array<'NO_INCHARGE' | 'UNDER_STAFFED'> = [];
    if (icCount < inMin) violations.push('NO_INCHARGE');
    if ((unique.length ?? 0) < demand) violations.push('UNDER_STAFFED');
    // (หมายเหตุ: ไม่บังคับ inMax ที่นี่ — เผื่อ override ด้วยมือ; ถ้าต้องการบังคับ เพิ่ม 'OVER_INCHARGE' และ reject)

    // --------- build context for per-person checks ---------
    // index assignments by day & shift
    const idxByDayShift: Record<string, string[]> = {};
    for (const a of monthAssignments) {
      idxByDayShift[key(a.day, a.shift as ShiftType)] = a.staffIds || [];
    }
    const getAssigned = (d: number, s: ShiftType) => idxByDayShift[key(d, s)] || [];
    const getShiftsOnDay = (d: number, sid: string) => SHIFTS.filter((s) => getAssigned(d, s).includes(sid));

    // day-off set map
    const dayOffMap: Record<string, Set<number>> = {};
    const plannerDayOff = (planner?.dayOff || {}) as Record<string, number[]>;
    for (const sid of Object.keys(plannerDayOff)) {
      dayOffMap[sid] = new Set(plannerDayOff[sid] || []);
    }

    // helper: pair key for day (if 2 shifts)
    const pairKeyFor = (d: number, sid: string): string | null => {
      const arr = getShiftsOnDay(d, sid);
      if (arr.length !== 2) return null;
      const [a, b] = [...arr].sort(sortShift);
      return `${a}+${b}`;
    };

    // simulate adding this slot to compute errors
    const errorsByStaff: Record<string, string[]> = {}; // สาเหตุต่อคน (ไม่บล็อกการบันทึก แต่แจ้งกลับไปให้ UI)

    for (const sid of unique) {
      const reasons: string[] = [];

      // dayOff
      if (dayOffMap[sid]?.has(day)) reasons.push('dayOff');

      // max 2 shifts/day
      const alreadyToday = getShiftsOnDay(day, sid);
      const countTodayAfter = (alreadyToday.includes(shift) ? alreadyToday : [...alreadyToday, shift]).length;
      if (countTodayAfter > 2) reasons.push('เกิน 2 เวร/วัน');

      // NIGHT -> MORNING (check only when saving MORNING)
      if (shift === 'MORNING') {
        const prevNight = day > 1 ? getAssigned(day - 1, 'NIGHT') : [];
        if (prevNight.includes(sid)) reasons.push('ห้าม NIGHT→MORNING วันถัดไป');
      }

      // คู่ 2 เวร/วันซ้ำกันเกิน 3 วันติด (เมื่อวันนี้กลายเป็น 2 เวร)
      const arrAfter =
        countTodayAfter === 2
          ? ([...(alreadyToday.includes(shift) ? alreadyToday : [...alreadyToday, shift])].sort(sortShift) as [
              ShiftType,
              ShiftType
            ])
          : null;

      if (arrAfter) {
        const todayPair = `${arrAfter[0]}+${arrAfter[1]}`;
        let run = 0;
        for (let d = day - 1; d >= 1; d--) {
          const pk = pairKeyFor(d, sid);
          if (pk === todayPair) run += 1;
          else break;
        }
        if (run >= 3) reasons.push('ห้าม 2 เวรคู่เดิมซ้ำเกิน 3 วันติด');
      }

      if (reasons.length) errorsByStaff[sid] = reasons;
    }

    // --------- persist ---------
    const id = `${wid}-${ym}-${day}-${shift}`;
    await setDoc(
      doc(db, 'assignments', id),
      {
        wid,
        ym,
        day,
        shift,
        staffIds: unique,
        violations,
        source: 'MANUAL',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      id,
      violations,
      incharge: { count: icCount, min: inMin, max: inMax },
      demand,
      savedCount: unique.length,
      errorsByStaff, // ให้ UI เอาไปแจ้งละเอียดได้
    });
  } catch (err: any) {
    console.error('assignments/upsert error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
