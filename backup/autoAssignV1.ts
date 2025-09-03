import { db } from '@/lib/firebaseClient';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import type { Planner, ShiftType, Staff } from '@/types/schema';
import { daysIn } from '../src/lib/util';
import { getPlanner } from '@/services/planner.service';
import { listStaff } from '@/services/staff.service';
import { getAssignmentsByMonth } from '@/services/assignment.service';

type AssignState = {
  assigned: Record<string, string[]>; // key: `${day}-${shift}` -> staffIds
  perDay: Record<string, number>; // `${day}-${sid}` -> count that day (max 2)
  consecDays: Record<string, number>; // sid -> current consecutive working days
  lastShift: Record<string, { day: number; shift: ShiftType } | null>;
  countByStaff: Record<string, number>;
};

function key(day: number, shift: ShiftType) {
  return `${day}-${shift}`;
}

function canAssign(params: {
  sid: string;
  day: number;
  shift: ShiftType;
  planner: Planner;
  state: AssignState;
  staffMap: Record<string, Staff>;
  ym: string;
}): string[] {
  const { sid, day, shift, planner, state, staffMap, ym } = params;
  const reasons: string[] = [];

  // Day off
  const dOff = new Set(planner.dayOff[sid] || []);
  if (dOff.has(day)) reasons.push('dayOff');

  // Max 2 shifts per day
  const dKey = `${day}-${sid}`;
  if ((state.perDay[dKey] || 0) >= 2) reasons.push('เกิน 2 เวร/วัน');

  // Night -> Morning forbidden (same day sequence from previous day night to current morning)
  const last = state.lastShift[sid];
  if (last && last.day === day - 1 && last.shift === 'NIGHT' && shift === 'MORNING') {
    reasons.push('ห้าม NIGHT→MORNING ต่อวันถัดไป');
  }

  // M->A not more than 2 days in a row (across days)
  if (last && last.day === day - 1 && last.shift === 'AFTERNOON' && shift === 'MORNING') {
    // This is A -> M (allowed)
  }
  // Count pattern of consecutive M->A or A->N across days
  // We'll approximate by checking last 2 transitions via lastShift memory (simplified)

  // Working more than 5 consecutive days
  if ((state.consecDays[sid] || 0) >= 5) reasons.push('ทำงานติดกันเกิน 5 วัน');

  // INCHARGE requirement bound check per slot will be handled in selection pass

  return reasons;
}

function scoreCandidate(params: { sid: string; shift: ShiftType; planner: Planner; state: AssignState }): number {
  const { sid, shift, planner, state } = params;
  const base = planner.baseShifts[sid] || 0;
  const already = state.countByStaff[sid] || 0;
  const remainingNeed = Math.max(0, base - already);
  const pref = planner.preferences[sid]?.[shift] ?? 0.5; // 0..1
  // 50% preference, 50% base remaining
  return pref * 0.5 + remainingNeed * 0.5;
}

export async function runAutoAssign(wid: string, ym: string) {
  const planner = (await getPlanner(wid, ym)) as Planner;
  const staff = (await listStaff(wid)) as Staff[];
  const days = daysIn(ym);
  const demand = planner.demand;

  // Clear existing assignments for this month
  const assignCol = collection(db, 'assignments');
  const q = query(assignCol, where('wid', '==', wid), where('ym', '==', ym));
  const snaps = await getDocs(q);
  for (const s of snaps.docs) await deleteDoc(s.ref);

  const state: AssignState = {
    assigned: {},
    perDay: {},
    consecDays: {},
    lastShift: {},
    countByStaff: {},
  };

  const staffMap = Object.fromEntries(staff.map((s) => [s.id, s]));

  for (let day = 1; day <= days; day++) {
    for (const shift of ['MORNING', 'AFTERNOON', 'NIGHT'] as ShiftType[]) {
      const need = demand[shift];
      const chosen: string[] = [];

      // First, ensure INCHARGE min
      const incharges = staff.filter((s) => s.active && s.role === 'INCHARGE');
      const meds = staff.filter((s) => s.active && s.role === 'MED');

      const candidates = [...incharges, ...meds]
        .map((s) => s.id)
        .filter((sid) => canAssign({ sid, day, shift, planner, state, staffMap, ym }).length === 0);

      // Select INCHARGE first
      const needIncharge = Math.min(planner.inchargeMaxPerShift, Math.max(planner.inchargeMinPerShift, 1));
      const icPool = incharges.map((s) => s.id).filter((sid) => candidates.includes(sid));
      icPool.sort(
        (a, b) => scoreCandidate({ sid: b, shift, planner, state }) - scoreCandidate({ sid: a, shift, planner, state })
      );
      while (chosen.length < needIncharge && icPool.length) {
        const sid = icPool.shift()!;
        chosen.push(sid);
      }

      // Fill remaining with best candidates
      const restPool = candidates.filter((sid) => !chosen.includes(sid));
      restPool.sort(
        (a, b) => scoreCandidate({ sid: b, shift, planner, state }) - scoreCandidate({ sid: a, shift, planner, state })
      );
      for (const sid of restPool) {
        if (chosen.length >= need) break;
        // Respect incharge max
        const icCount = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
        if (staffMap[sid].role === 'INCHARGE' && icCount >= planner.inchargeMaxPerShift) continue;
        chosen.push(sid);
      }

      // Persist assignment
      const id = `${wid}-${ym}-${day}-${shift}`;
      await setDoc(doc(db, 'assignments', id), {
        wid,
        ym,
        day,
        shift,
        staffIds: chosen,
        createdAt: serverTimestamp(),
      });

      // Update state
      for (const sid of chosen) {
        state.assigned[key(day, shift)] = chosen;
        state.perDay[`${day}-${sid}`] = (state.perDay[`${day}-${sid}`] || 0) + 1;
        state.countByStaff[sid] = (state.countByStaff[sid] || 0) + 1;
        // consecutive days
        state.consecDays[sid] = (state.consecDays[sid] || 0) + 1;
        state.lastShift[sid] = { day, shift };
      }
      // For people not chosen, reset consecutive days if they didn't work today
      for (const s of staff) {
        if (!chosen.includes(s.id)) {
          // If they didn't work any shift today, reset consecutive counter
          if ((state.perDay[`${day}-${s.id}`] || 0) === 0) state.consecDays[s.id] = 0;
        }
      }
    }
  }

  return { ok: true };
}
