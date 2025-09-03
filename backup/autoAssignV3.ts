import { db } from '@/lib/firebaseClient';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import type { Planner, ShiftType, Staff } from '@/types/schema';
import { daysIn } from '../src/lib/util';
import { getPlanner } from '@/services/planner.service';
import { listStaff } from '@/services/staff.service';
import { getAssignmentsByMonth } from '@/services/assignment.service';

type AssignState = {
  assigned: Record<string, string[]>;
  perDay: Record<string, number>;
  consecDays: Record<string, number>;
  lastShift: Record<string, { day: number; shift: ShiftType } | null>;
  countByStaff: Record<string, number>;
};

type SlotViolation = 'NO_INCHARGE' | 'UNDER_STAFFED';
type Mode = 'ALL' | 'INCHARGE' | 'MED';

const ORDER: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];
const sortShift = (a: ShiftType, b: ShiftType) => ORDER.indexOf(a) - ORDER.indexOf(b);
function key(day: number, shift: ShiftType) {
  return `${day}-${shift}`;
}

function shiftsOnDay(state: AssignState, sid: string, day: number): ShiftType[] {
  const arr: ShiftType[] = [];
  for (const s of ORDER) {
    const k = key(day, s);
    if ((state.assigned[k] || []).includes(sid)) arr.push(s);
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
  // เช็คกติกาเฉพาะตอนที่จะกลายเป็น "2 เวร/วัน"
  if (today.length !== 1) return false;
  const pairNow = [today[0], proposed].sort(sortShift) as [ShiftType, ShiftType];
  const pairKey = `${pairNow[0]}+${pairNow[1]}`;

  // นับย้อนหลังว่า "คู่เดิม" ซ้ำมากี่วันแล้ว (เฉพาะวันที่มี 2 เวร)
  let run = 0;
  for (let d = day - 1; d >= 1; d--) {
    const k = dayPairKey(state, sid, d);
    if (k === pairKey) run += 1;
    else break;
  }
  // ถ้า 3 วันติดอยู่แล้ว การทำซ้ำในวันนี้จะเป็น "เกิน 3 วัน" → ห้าม
  return run >= 3;
}

function isHardBlocked(sid: string, day: number, shift: ShiftType, planner: Planner, state: AssignState): string[] {
  const reasons: string[] = [];
  const dOff = new Set(planner.dayOff[sid] || []);
  if (dOff.has(day)) reasons.push('dayOff');

  // Max 2 shifts/day (hard)
  const dKey = `${day}-${sid}`;
  if ((state.perDay[dKey] ?? 0) >= 2) reasons.push('เกิน 2 เวร/วัน');

  // NIGHT -> MORNING next day (hard)
  const last = state.lastShift[sid];
  if (last && last.day === day - 1 && last.shift === 'NIGHT' && shift === 'MORNING') {
    reasons.push('ห้าม NIGHT→MORNING วันถัดไป');
  }

  // NEW hard rule: ห้าม 2 เวร/วันคู่เดิม ซ้ำติดกันเกิน 3 วัน
  if (wouldCreatePairViolation(state, sid, day, shift)) {
    reasons.push('ห้าม 2 เวรคู่เดิมซ้ำเกิน 3 วันติด');
  }

  return reasons;
}

// เงื่อนไขอ่อน (soft) เหลือเฉพาะ "ทำงานติดกันเกิน 5 วัน" เท่านั้น
function softPenalty(sid: string, day: number, _shift: ShiftType, _planner: Planner, state: AssignState): number {
  let penalty = 0;
  if ((state.consecDays[sid] ?? 0) >= 5) penalty += 1.0;
  return penalty;
}

function scoreCandidate(sid: string, shift: ShiftType, planner: Planner, state: AssignState): number {
  const base = planner.baseShifts[sid] || 0;
  const already = state.countByStaff[sid] || 0;
  const remainingNeed = Math.max(0, base - already);
  const pref = planner.preferences[sid]?.[shift] ?? 0.5;
  return pref * 0.5 + remainingNeed * 0.5;
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
  const sorted = [...items].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return (a.shift || '').localeCompare(b.shift || '');
  });

  for (const a of sorted) {
    const k = key(a.day, a.shift);
    map[k] = a;
    state.assigned[k] = a.staffIds || [];
    for (const sid of a.staffIds || []) {
      const dk = `${a.day}-${sid}`;
      state.perDay[dk] = (state.perDay[dk] ?? 0) + 1;
      state.countByStaff[sid] = (state.countByStaff[sid] ?? 0) + 1;
      state.consecDays[sid] = (state.consecDays[sid] ?? 0) + 1;
      state.lastShift[sid] = { day: a.day, shift: a.shift };
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

  if (mode === 'ALL') {
    // ล้างเดิมทั้งเดือน
    const assignCol = collection(db, 'assignments');
    const qClear = query(assignCol, where('wid', '==', wid), where('ym', '==', ym));
    const snaps = await getDocs(qClear);
    for (const s of snaps.docs) await deleteDoc(s.ref);

    const state: AssignState = { assigned: {}, perDay: {}, consecDays: {}, lastShift: {}, countByStaff: {} };

    for (let day = 1; day <= days; day++) {
      for (const shift of ORDER) {
        const need = demand[shift];
        const chosen: string[] = [];
        const violations: SlotViolation[] = [];

        // 1) เลือก INCHARGE ก่อน (strict → soft)
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
          chosen.push(icStrict.shift()!);
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

        // 2) เติมคนที่เหลือ (จำกัด INCHARGE ไม่เกิน inMax)
        const pool = [...incharges, ...meds].filter(
          (sid) => !chosen.includes(sid) && isHardBlocked(sid, day, shift, planner, state).length === 0
        );
        pool.sort((a, b) => {
          const icCount = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
          const aIC = staffMap[a].role === 'INCHARGE' && icCount >= inMax;
          const bIC = staffMap[b].role === 'INCHARGE' && icCount >= inMax;
          if (aIC !== bIC) return aIC ? 1 : -1;
          const sb = scoreCandidate(b, shift, planner, state) - softPenalty(b, day, shift, planner, state);
          const sa = scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state);
          return sb - sa;
        });
        for (const sid of pool) {
          if (chosen.length >= need) break;
          const icCount = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
          if (staffMap[sid].role === 'INCHARGE' && icCount >= inMax) continue;
          chosen.push(sid);
        }

        // 3) ตรวจ violations
        const icFinal = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
        if (icFinal < inMin) violations.push('NO_INCHARGE');
        if (chosen.length < need) violations.push('UNDER_STAFFED');

        // 4) persist + อัปเดต state
        const id = `${wid}-${ym}-${day}-${shift}`;
        await setDoc(doc(db, 'assignments', id), {
          wid,
          ym,
          day,
          shift,
          staffIds: chosen,
          violations,
          createdAt: serverTimestamp(),
        });

        for (const sid of chosen) {
          const dk = `${day}-${sid}`;
          state.assigned[key(day, shift)] = chosen;
          state.perDay[dk] = (state.perDay[dk] ?? 0) + 1;
          state.countByStaff[sid] = (state.countByStaff[sid] ?? 0) + 1;
          state.consecDays[sid] = (state.consecDays[sid] ?? 0) + 1;
          state.lastShift[sid] = { day, shift };
        }
      }
    }
    return { ok: true, mode };
  }

  // ------- โหมดเติม (incremental) -------
  const { state, existingMap } = await loadStateFromExisting(wid, ym);

  for (let day = 1; day <= days; day++) {
    for (const shift of ORDER) {
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
            chosen.push(pool.shift()!);
          }
        }
      }

      if (mode === 'MED') {
        if (chosen.length < need) {
          const pool = meds
            .filter((sid) => !chosen.includes(sid))
            .filter((sid) => isHardBlocked(sid, day, shift, planner, state).length === 0)
            .sort((a, b) => {
              const sb = scoreCandidate(b, shift, planner, state) - softPenalty(b, day, shift, planner, state);
              const sa = scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state);
              return sb - sa;
            });
          while (chosen.length < need && pool.length) {
            chosen.push(pool.shift()!);
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
        updatedAt: serverTimestamp(),
      });

      const newlyAdded = chosen.filter((id) => !existing.includes(id));
      for (const sid of newlyAdded) {
        const dk = `${day}-${sid}`;
        state.assigned[k] = chosen;
        state.perDay[dk] = (state.perDay[dk] ?? 0) + 1;
        state.countByStaff[sid] = (state.countByStaff[sid] ?? 0) + 1;
        state.consecDays[sid] = (state.consecDays[sid] ?? 0) + 1;
        state.lastShift[sid] = { day, shift };
      }
    }
  }

  return { ok: true, mode };
}
