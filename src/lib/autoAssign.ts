import { db } from '@/lib/firebaseClient';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import type { Planner, ShiftType, Staff } from '@/types/schema';
import { daysIn } from './util';
import { getPlanner } from '@/services/planner.service';
import { listStaff } from '@/services/staff.service';
import { getAssignmentsByMonth } from '@/services/assignment.service';

type AssignState = {
  assigned: Record<string, string[]>;
  perDay: Record<string, number>; // key = `${day}-${sid}` -> #shifts on that day
  consecDays: Record<string, number>; // consecutive worked **days** (count only once/day)
  lastShift: Record<string, { day: number; shift: ShiftType } | null>; // last worked day & shift
  countByStaff: Record<string, number>; // total assigned shifts
};

type SlotViolation = 'NO_INCHARGE' | 'UNDER_STAFFED';
type Mode = 'ALL' | 'INCHARGE' | 'MED';

// จัดลำดับใหม่: ดึกก่อน เพื่อลดเคส N ไม่มี INCHARGE
const ORDER: ShiftType[] = ['NIGHT', 'MORNING', 'AFTERNOON'];
const DISPLAY_ORDER: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT']; // สำหรับ sort คู่ต่อวัน
const sortShift = (a: ShiftType, b: ShiftType) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b);

const key = (day: number, shift: ShiftType) => `${day}-${shift}`;

function shiftsOnDay(state: AssignState, sid: string, day: number): ShiftType[] {
  const arr: ShiftType[] = [];
  for (const s of DISPLAY_ORDER) {
    const k = key(day, s as ShiftType);
    if ((state.assigned[k] || []).includes(sid)) arr.push(s as ShiftType);
  }
  return arr;
}

function dayPairKey(state: AssignState, sid: string, day: number): string | null {
  const arr = shiftsOnDay(state, sid, day);
  if (arr.length !== 2) return null;
  const [a, b] = [...arr].sort(sortShift);
  return `${a}+${b}`;
}

function wouldCreatePairViolation(state: AssignState, sid: string, day: number, proposed: ShiftType): boolean {
  const today = shiftsOnDay(state, sid, day);
  if (today.length !== 1) return false; // ตรวจตอนกำลังจะกลายเป็น 2 เวร/วันเท่านั้น
  const pairNow = [today[0], proposed].sort(sortShift) as [ShiftType, ShiftType];
  const pairKey = `${pairNow[0]}+${pairNow[1]}`;
  let run = 0;
  for (let d = day - 1; d >= 1; d--) {
    const k = dayPairKey(state, sid, d);
    if (k === pairKey) run += 1;
    else break;
  }
  return run >= 3; // จะเป็นวันที่ 4 ติดต่อกัน → ห้าม
}

// ✅ กติกาแข็ง: ห้ามทำงานติดกันเกิน 5 วัน (นับเป็น "วัน" ไม่ใช่จำนวนเวร)
// จะบล็อกเฉพาะตอนเพิ่ม "เวรแรกของวัน" เท่านั้น
function wouldExceedConsecutiveDays(sid: string, day: number, state: AssignState): boolean {
  const dKey = `${day}-${sid}`;
  const alreadyToday = state.perDay[dKey] ?? 0;
  if (alreadyToday > 0) return false; // วันนี้ถูกนับไปแล้ว

  const last = state.lastShift[sid];
  const prevIsYesterday = !!last && last.day === day - 1;
  const currentRun = state.consecDays[sid] ?? 0;
  const nextRun = prevIsYesterday ? currentRun + 1 : 1;
  return nextRun > 5;
}

function isHardBlocked(sid: string, day: number, shift: ShiftType, planner: Planner, state: AssignState): string[] {
  const reasons: string[] = [];

  const dOff = new Set(planner.dayOff?.[sid] || []);
  if (dOff.has(day)) reasons.push('dayOff');

  const dKey = `${day}-${sid}`;
  if ((state.perDay[dKey] ?? 0) >= 2) reasons.push('เกิน 2 เวร/วัน');

  const last = state.lastShift[sid];
  if (last && last.day === day - 1 && last.shift === 'NIGHT' && shift === 'MORNING') {
    reasons.push('ห้าม NIGHT→MORNING วันถัดไป');
  }

  if (wouldCreatePairViolation(state, sid, day, shift)) {
    reasons.push('ห้าม 2 เวรคู่เดิมซ้ำเกิน 3 วันติด');
  }

  if (wouldExceedConsecutiveDays(sid, day, state)) {
    reasons.push('ห้ามทำงานติดกันเกิน 5 วัน');
  }

  return reasons;
}

// ลดคะแนนเฉพาะกรณีทำงานติดกันนาน (เผื่อบางที่ผ่อนปรน)
function softPenalty(sid: string, day: number, _shift: ShiftType, _planner: Planner, state: AssignState): number {
  let penalty = 0;
  if ((state.consecDays[sid] ?? 0) >= 5) penalty += 1.0;
  return penalty;
}

// คะแนนคัดเลือก: พิจารณา base ที่ยังไม่ครบ + OT ขั้นต่ำที่ยังขาด + ความชอบเวร
function scoreCandidate(sid: string, shift: ShiftType, planner: Planner, state: AssignState): number {
  const base = planner.baseShifts?.[sid] || 0;
  const already = state.countByStaff[sid] || 0;
  const pref = planner.preferences?.[sid]?.[shift] ?? 0.5;

  const baseRemaining = Math.max(0, base - already);
  const baseNorm = base > 0 ? baseRemaining / base : 0;

  const currentOT = Math.max(0, already - base);
  const minOT = planner.minOT?.[sid] || 0;
  const otDeficit = Math.max(0, minOT - currentOT);
  const otNorm = minOT > 0 ? otDeficit / minOT : 0;

  return pref * 0.3 + baseNorm * 0.35 + otNorm * 0.35;
}

// อัปเดต state เมื่อเพิ่มคนลงเวร
function applyPick(state: AssignState, day: number, shift: ShiftType, chosenForSlot: string[], sid: string) {
  const k = key(day, shift);
  const dk = `${day}-${sid}`;

  // เพิ่มในช่อง
  if (!state.assigned[k]) state.assigned[k] = [];
  if (!state.assigned[k].includes(sid)) state.assigned[k] = [...chosenForSlot];

  const prevCountToday = state.perDay[dk] ?? 0;
  state.perDay[dk] = prevCountToday + 1;
  state.countByStaff[sid] = (state.countByStaff[sid] ?? 0) + 1;

  // นับ consecutive **ต่อวัน** เฉพาะเวรแรกของวัน
  if (prevCountToday === 0) {
    const last = state.lastShift[sid];
    const cont = last && last.day === day - 1 ? (state.consecDays[sid] ?? 0) + 1 : 1;
    state.consecDays[sid] = cont;
  }

  // อัปเดต lastShift
  state.lastShift[sid] = { day, shift };
}

async function loadStateFromExisting(
  wid: string,
  ym: string
): Promise<{
  state: AssignState;
  existingMap: Record<string, { day: number; shift: ShiftType; staffIds: string[]; violations?: string[] }>;
}> {
  const state: AssignState = {
    assigned: {},
    perDay: {},
    consecDays: {},
    lastShift: {},
    countByStaff: {},
  };

  const items = await getAssignmentsByMonth(wid, ym);
  const map: Record<string, any> = {};
  // index per day for consecutive-day rebuild
  const byDay: Record<number, Set<string>> = {};

  // ใช้ sort ช่วยให้ lastShift ของแต่ละคนในวันนั้น ๆ เป็นเวรที่อยู่หลังสุดของวัน
  const sorted = [...items].sort((a, b) => (a.day !== b.day ? a.day - b.day : sortShift(a.shift, b.shift)));

  for (const a of sorted) {
    const k = key(a.day, a.shift as ShiftType);
    map[k] = a;
    state.assigned[k] = a.staffIds || [];
    for (const sid of a.staffIds || []) {
      state.countByStaff[sid] = (state.countByStaff[sid] ?? 0) + 1;
      state.lastShift[sid] = { day: a.day, shift: a.shift as ShiftType };
      // perDay (จำนวนเวรต่อวัน)
      const dk = `${a.day}-${sid}`;
      state.perDay[dk] = (state.perDay[dk] ?? 0) + 1;
      // build set สำหรับนับ consecutive **ต่อวัน**
      if (!byDay[a.day]) byDay[a.day] = new Set();
      byDay[a.day].add(sid);
    }
  }

  // rebuild consecDays ให้ถูกต้อง (นับแค่วันละ 1 ครั้ง)
  const [yy, mm] = ym.split('-').map(Number);
  const totalDays = new Date(yy, mm, 0).getDate();
  const lastWorked: Record<string, number | undefined> = {};
  for (let d = 1; d <= totalDays; d++) {
    const set = byDay[d];
    if (!set) continue;
    for (const sid of set) {
      const prev = lastWorked[sid];
      state.consecDays[sid] = prev === d - 1 ? (state.consecDays[sid] ?? 0) + 1 : 1;
      lastWorked[sid] = d;
    }
  }

  return { state, existingMap: map };
}

export async function runAutoAssign(wid: string, ym: string, mode: Mode = 'ALL') {
  const planner = (await getPlanner(wid, ym)) as Planner;
  const staff = (await listStaff(wid)) as Staff[];
  const days = daysIn(ym);
  const demand = planner.demand;

  const staffMap = Object.fromEntries(staff.map((s) => [s.id, s]));
  const incharges = staff.filter((s) => s.active && s.role === 'INCHARGE').map((s) => s.id);
  const meds = staff.filter((s) => s.active && s.role === 'MED').map((s) => s.id);

  const inMin = Math.max(1, planner.inchargeMinPerShift ?? 1);
  const inMax = Math.max(inMin, planner.inchargeMaxPerShift ?? 2);

  const isLastNight = (day: number, shift: ShiftType) => planner.skipLastNight && day === days && shift === 'NIGHT';

  if (mode === 'ALL') {
    // ล้างเดิมทั้งเดือน
    const assignCol = collection(db, 'assignments');
    const qClear = query(assignCol, where('wid', '==', wid), where('ym', '==', ym));
    const snaps = await getDocs(qClear);
    for (const s of snaps.docs) await deleteDoc(s.ref);

    const state: AssignState = { assigned: {}, perDay: {}, consecDays: {}, lastShift: {}, countByStaff: {} };
    const slotStaff: Record<string, string[]> = {};

    // -------- รอบที่ 1: จัดพื้นฐาน (N → M → A) ----------
    for (let day = 1; day <= days; day++) {
      for (const shift of ORDER) {
        if (isLastNight(day, shift)) continue;

        const need = demand[shift];
        const chosen: string[] = [];
        const violations: SlotViolation[] = [];

        // 1) เลือก INCHARGE ให้ถึง inMin (ไม่เกิน inMax)
        const icStrict = incharges
          .filter((sid) => isHardBlocked(sid, day, shift, planner, state).length === 0)
          .sort((a, b) => {
            const sb = scoreCandidate(b, shift, planner, state) - softPenalty(b, day, shift, planner, state);
            const sa = scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state);
            return sb - sa;
          });
        while (
          chosen.filter((id) => staffMap[id].role === 'INCHARGE').length < Math.min(inMax, inMin) &&
          icStrict.length
        ) {
          const pick = icStrict.shift()!;
          chosen.push(pick);
        }
        if (chosen.filter((id) => staffMap[id].role === 'INCHARGE').length < inMin) {
          const icSoft = incharges
            .filter((sid) => !chosen.includes(sid))
            .filter((sid) => isHardBlocked(sid, day, shift, planner, state).length === 0)
            .sort((a, b) => scoreCandidate(b, shift, planner, state) - scoreCandidate(a, shift, planner, state));
          while (chosen.filter((id) => staffMap[id].role === 'INCHARGE').length < inMin && icSoft.length) {
            chosen.push(icSoft.shift()!);
          }
        }

        // 2) เติมคนจนถึง need — เลี่ยง INCHARGE เกิน inMin ถ้า MED ยังพอ
        const poolAll = [...incharges, ...meds]
          .filter((sid) => !chosen.includes(sid) && isHardBlocked(sid, day, shift, planner, state).length === 0)
          .sort((a, b) => {
            const icCount = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
            const roleRank = (sid: string) => {
              const isIC = staffMap[sid].role === 'INCHARGE';
              if (!isIC) return 0;
              return icCount >= inMin ? 2 : 1; // INCHARGE เกิน min โดนถ่วง
            };
            const rb = roleRank(b) - roleRank(a);
            if (rb !== 0) return rb;
            const sb = scoreCandidate(b, shift, planner, state) - softPenalty(b, day, shift, planner, state);
            const sa = scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state);
            return sb - sa;
          });

        let medsAvail = poolAll.filter((sid) => staffMap[sid].role === 'MED').length;

        for (const sid of poolAll) {
          if (chosen.length >= need) break;
          const isIC = staffMap[sid].role === 'INCHARGE';
          const icCount = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
          if (isIC && icCount >= inMax) continue;
          if (isIC && icCount >= inMin) {
            const remainingSlots = need - chosen.length;
            if (medsAvail >= remainingSlots) continue; // ใช้ MED ก่อน
          }
          chosen.push(sid);
          if (!isIC) medsAvail -= 1;
        }

        // 3) violations
        const icFinal = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
        if (icFinal < inMin) violations.push('NO_INCHARGE');
        if (chosen.length < need) violations.push('UNDER_STAFFED');

        // 4) persist + state
        const id = `${wid}-${ym}-${day}-${shift}`;
        slotStaff[key(day, shift)] = [...chosen];
        await setDoc(doc(db, 'assignments', id), {
          wid,
          ym,
          day,
          shift,
          staffIds: chosen,
          violations,
          source: 'AUTO',
          createdAt: serverTimestamp(),
        });

        for (const sid of chosen) applyPick(state, day, shift, slotStaff[key(day, shift)], sid);
      }
    }

    // -------- รอบที่ 2: บังคับให้ครบ base + minOT (quota fill) ----------
    const targetByStaff: Record<string, number> = {};
    for (const s of staff) {
      if (!s.active) continue;
      const base = planner.baseShifts?.[s.id] || 0;
      const minOT = planner.minOT?.[s.id] || 0;
      targetByStaff[s.id] = base + minOT;
    }

    let changed = true;
    let safety = 5;
    while (changed && safety-- > 0) {
      changed = false;

      const deficitOrder = Object.keys(targetByStaff)
        .map((sid) => ({
          sid,
          deficit: Math.max(0, (targetByStaff[sid] ?? 0) - (state.countByStaff[sid] ?? 0)),
        }))
        .filter((x) => x.deficit > 0)
        .sort((a, b) => b.deficit - a.deficit);

      if (!deficitOrder.length) break;

      for (let day = 1; day <= days; day++) {
        for (const shift of ORDER) {
          if (isLastNight(day, shift)) continue;

          const k = key(day, shift);
          const need = demand[shift];
          const chosen = slotStaff[k] || [];
          if (chosen.length >= need) continue;

          const icCount = chosen.filter((id) => staffMap[id]?.role === 'INCHARGE').length;

          // ถ้า INCHARGE ยังไม่ถึงขั้นต่ำ ให้พยายาม INCHARGE ก่อน
          const wantICFirst = icCount < inMin;

          const pool = deficitOrder
            .map((x) => x.sid)
            .filter((sid) => !chosen.includes(sid))
            .filter((sid) => isHardBlocked(sid, day, shift, planner, state).length === 0)
            .filter((sid) => !(staffMap[sid]?.role === 'INCHARGE' && icCount >= inMax))
            .sort((a, b) => {
              // จัดอันดับตามความต้องการบทบาทก่อน (ถ้าขาด INCHARGE)
              if (wantICFirst) {
                const ra = staffMap[a].role === 'INCHARGE' ? 0 : 1;
                const rb = staffMap[b].role === 'INCHARGE' ? 0 : 1;
                if (ra !== rb) return ra - rb;
              }
              // แล้วค่อยตาม deficit และคะแนนรวม
              const defA = Math.max(0, (targetByStaff[a] ?? 0) - (state.countByStaff[a] ?? 0));
              const defB = Math.max(0, (targetByStaff[b] ?? 0) - (state.countByStaff[b] ?? 0));
              if (defB !== defA) return defB - defA;
              const sb = scoreCandidate(b, shift, planner, state) - softPenalty(b, day, shift, planner, state);
              const sa = scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state);
              return sb - sa;
            });

          if (pool.length) {
            const sid = pool[0];
            chosen.push(sid);
            slotStaff[k] = chosen;
            applyPick(state, day, shift, chosen, sid);
            changed = true;
          }
        }
      }
    }

    // สรุป violations ใหม่ แล้วเขียนทับทุกช่อง
    for (let day = 1; day <= days; day++) {
      for (const shift of ORDER) {
        if (isLastNight(day, shift)) continue;

        const k = key(day, shift);
        const chosen = slotStaff[k] || [];
        const need = demand[shift];
        const icFinal = chosen.filter((id) => staffMap[id]?.role === 'INCHARGE').length;

        const vios: SlotViolation[] = [];
        if (icFinal < inMin) vios.push('NO_INCHARGE');
        if (chosen.length < need) vios.push('UNDER_STAFFED');

        const id = `${wid}-${ym}-${day}-${shift}`;
        await setDoc(doc(db, 'assignments', id), {
          wid,
          ym,
          day,
          shift,
          staffIds: chosen,
          violations: vios,
          source: 'AUTO',
          updatedAt: serverTimestamp(),
        });
      }
    }

    return { ok: true, mode };
  }

  // ------- โหมดเติมเฉพาะบทบาท (INCHARGE / MED) -------
  const { state, existingMap } = await loadStateFromExisting(wid, ym);

  for (let day = 1; day <= days; day++) {
    for (const shift of ORDER) {
      if (isLastNight(day, shift)) continue;

      const need = demand[shift];
      const k = key(day, shift);
      const existing = existingMap[k]?.staffIds || [];
      const chosen = [...existing];

      const countIC = chosen.filter((id) => staffMap[id]?.role === 'INCHARGE').length;

      if (mode === 'INCHARGE') {
        if (countIC < inMin && chosen.length < need) {
          const pool = incharges
            .filter((sid) => !chosen.includes(sid))
            .filter((sid) => isHardBlocked(sid, day, shift, planner, state).length === 0)
            .sort((a, b) => {
              const sb = scoreCandidate(b, shift, planner, state) - softPenalty(b, day, shift, planner, state);
              const sa = scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state);
              return sb - sa;
            });
          while (
            chosen.filter((id) => staffMap[id].role === 'INCHARGE').length < Math.min(inMax, inMin) &&
            chosen.length < need &&
            pool.length
          ) {
            const pick = pool.shift()!;
            chosen.push(pick);
            applyPick(state, day, shift, chosen, pick);
          }
        }
      }

      if (mode === 'MED') {
        if (chosen.length < need) {
          const icCountNow = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
          const poolAll = [...meds, ...incharges]
            .filter((sid) => !chosen.includes(sid))
            .filter((sid) => isHardBlocked(sid, day, shift, planner, state).length === 0)
            .sort((a, b) => {
              const icCnt = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
              const roleRank = (sid: string) => {
                const isIC = staffMap[sid].role === 'INCHARGE';
                if (!isIC) return 0;
                return icCnt >= inMin ? 2 : 1;
              };
              const rb = roleRank(b) - roleRank(a);
              if (rb !== 0) return rb;
              const sb = scoreCandidate(b, shift, planner, state) - softPenalty(b, day, shift, planner, state);
              const sa = scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state);
              return sb - sa;
            });

          let medsAvail = poolAll.filter((sid) => staffMap[sid].role === 'MED').length;

          for (const sid of poolAll) {
            if (chosen.length >= need) break;
            const isIC = staffMap[sid].role === 'INCHARGE';
            const icCnt = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
            if (isIC && icCnt >= inMax) continue;
            if (isIC && icCnt >= inMin) {
              const remaining = need - chosen.length;
              if (medsAvail >= remaining) continue;
            }
            chosen.push(sid);
            applyPick(state, day, shift, chosen, sid);
            if (!isIC) medsAvail -= 1;
          }
        }
      }

      const vios: SlotViolation[] = [];
      const icFinal = chosen.filter((id) => staffMap[id]?.role === 'INCHARGE').length;
      if (icFinal < inMin) vios.push('NO_INCHARGE');
      if (chosen.length < need) vios.push('UNDER_STAFFED');

      const id = `${wid}-${ym}-${day}-${shift}`;
      await setDoc(doc(db, 'assignments', id), {
        wid,
        ym,
        day,
        shift,
        staffIds: chosen,
        violations: vios,
        source: 'AUTO',
        updatedAt: serverTimestamp(),
      });
    }
  }

  return { ok: true, mode };
}
