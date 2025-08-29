import { db } from '@/lib/firebaseClient';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import type { Planner, ShiftType, Staff } from '@/types/schema';
import { daysIn } from './util';
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

// ❗ จัดลำดับใหม่: ดึกก่อน เพื่อกันเคสดึกไม่มี INCHARGE
const ORDER: ShiftType[] = ['NIGHT', 'MORNING', 'AFTERNOON'];
const sortShift = (a: ShiftType, b: ShiftType) =>
  ['MORNING', 'AFTERNOON', 'NIGHT'].indexOf(a) - ['MORNING', 'AFTERNOON', 'NIGHT'].indexOf(b);
function key(day: number, shift: ShiftType) {
  return `${day}-${shift}`;
}

function shiftsOnDay(state: AssignState, sid: string, day: number): ShiftType[] {
  const arr: ShiftType[] = [];
  for (const s of ['MORNING', 'AFTERNOON', 'NIGHT'] as ShiftType[]) {
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
  if (today.length !== 1) return false; // ตรวจเฉพาะจังหวะที่จะกลายเป็น 2 เวร/วัน
  const pairNow = [today[0], proposed].sort(sortShift) as [ShiftType, ShiftType];
  const pairKey = `${pairNow[0]}+${pairNow[1]}`;
  // นับย้อนหลังว่าคู่เดิมซ้ำมากี่วันแล้ว
  let run = 0;
  for (let d = day - 1; d >= 1; d--) {
    const k = dayPairKey(state, sid, d);
    if (k === pairKey) run += 1;
    else break;
  }
  return run >= 3; // ถ้า 3 วันติดอยู่แล้ว วันนี้จะเป็นวันที่ 4 → ห้าม
}

function isHardBlocked(sid: string, day: number, shift: ShiftType, planner: Planner, state: AssignState): string[] {
  const reasons: string[] = [];
  const dOff = new Set(planner.dayOff[sid] || []);
  if (dOff.has(day)) reasons.push('dayOff');

  // Max 2 เวร/วัน
  const dKey = `${day}-${sid}`;
  if ((state.perDay[dKey] ?? 0) >= 2) reasons.push('เกิน 2 เวร/วัน');

  // ห้าม NIGHT→MORNING
  const last = state.lastShift[sid];
  if (last && last.day === day - 1 && last.shift === 'NIGHT' && shift === 'MORNING') {
    reasons.push('ห้าม NIGHT→MORNING วันถัดไป');
  }

  // NEW hard: ห้าม 2 เวร/วัน “คู่เดิม” ซ้ำเกิน 3 วันติด
  if (wouldCreatePairViolation(state, sid, day, shift)) {
    reasons.push('ห้าม 2 เวรคู่เดิมซ้ำเกิน 3 วันติด');
  }

  return reasons;
}

// soft: เหลือเฉพาะ “ทำงานติดกัน >=5 วัน” → ลดคะแนน
function softPenalty(sid: string, day: number, _shift: ShiftType, _planner: Planner, state: AssignState): number {
  let penalty = 0;
  if ((state.consecDays[sid] ?? 0) >= 5) penalty += 1.0;
  return penalty;
}

// ★ ให้ความสำคัญกับ base ที่ยังไม่ครบ + OT ขั้นต่ำที่ยัง “ขาด”
function scoreCandidate(sid: string, shift: ShiftType, planner: Planner, state: AssignState): number {
  const base = planner.baseShifts[sid] || 0;
  const already = state.countByStaff[sid] || 0;

  const pref = planner.preferences[sid]?.[shift] ?? 0.5; // 0..1

  const baseRemaining = Math.max(0, base - already);
  const baseNorm = base > 0 ? baseRemaining / base : 0;

  const currentOT = Math.max(0, already - base);
  const minOT = planner.minOT?.[sid] || 0;
  const otDeficit = Math.max(0, minOT - currentOT);
  const otNorm = minOT > 0 ? otDeficit / minOT : 0;

  return pref * 0.3 + baseNorm * 0.35 + otNorm * 0.35;
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
    const slotStaff: Record<string, string[]> = {};

    // -------- รอบที่ 1: จัดพื้นฐาน (ดึกก่อน) ----------
    for (let day = 1; day <= days; day++) {
      for (const shift of ORDER) {
        const need = demand[shift];
        const chosen: string[] = [];
        const violations: SlotViolation[] = [];

        // 1) เลือก INCHARGE ให้ถึง inMin (ไม่เกิน inMax)
        const icStrict = incharges
          .filter((sid) => isHardBlocked(sid, day, shift, planner, state).length === 0)
          .sort(
            (a, b) =>
              scoreCandidate(b, shift, planner, state) -
              softPenalty(b, day, shift, planner, state) -
              (scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state))
          );
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

        // 2) เติมคนจนถึง need — หลีกเลี่ยง INCHARGE เกิน inMin ถ้า MED ยังพอ
        const poolAll = [...incharges, ...meds]
          .filter((sid) => !chosen.includes(sid) && isHardBlocked(sid, day, shift, planner, state).length === 0)
          .sort((a, b) => {
            const icCount = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
            // อย่าดัน INCHARGE ถ้าเกิน inMin แล้ว (ยกเว้นจำเป็น)
            const roleRank = (sid: string) => {
              const isIC = staffMap[sid].role === 'INCHARGE';
              if (!isIC) return 0;
              return icCount >= inMin ? 2 : 1; // INCHARGE เกิน min โดนถ่วง
            };
            const rb = roleRank(b) - roleRank(a);
            if (rb !== 0) return rb;
            return (
              scoreCandidate(b, shift, planner, state) -
              softPenalty(b, day, shift, planner, state) -
              (scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state))
            );
          });

        // นับ MED ที่พร้อมใช้งานใน pool
        let medsAvail = poolAll.filter((sid) => staffMap[sid].role === 'MED').length;

        for (const sid of poolAll) {
          if (chosen.length >= need) break;
          const isIC = staffMap[sid].role === 'INCHARGE';
          const icCount = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;

          // เพดาน INCHARGE
          if (isIC && icCount >= inMax) continue;

          // ถ้าถึง inMin แล้ว และ MED ยังพอเติมให้ครบ ให้ “เลี่ยง” INCHARGE
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

        for (const sid of chosen) {
          const dk = `${day}-${sid}`;
          state.assigned[key(day, shift)] = slotStaff[key(day, shift)];
          state.perDay[dk] = (state.perDay[dk] ?? 0) + 1;
          state.countByStaff[sid] = (state.countByStaff[sid] ?? 0) + 1;
          state.consecDays[sid] = (state.consecDays[sid] ?? 0) + 1;
          state.lastShift[sid] = { day, shift };
        }
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
          const k = key(day, shift);
          const need = demand[shift];
          const chosen = slotStaff[k] || [];
          if (chosen.length >= need) continue;

          const icCount = chosen.filter((id) => staffMap[id]?.role === 'INCHARGE').length;

          // pool ของคนที่ยังขาด target
          const pool = deficitOrder
            .map((x) => x.sid)
            .filter((sid) => !chosen.includes(sid))
            .filter((sid) => isHardBlocked(sid, day, shift, planner, state).length === 0)
            .filter((sid) => !(staffMap[sid]?.role === 'INCHARGE' && icCount >= inMax))
            .sort((a, b) => {
              const defA = Math.max(0, (targetByStaff[a] ?? 0) - (state.countByStaff[a] ?? 0));
              const defB = Math.max(0, (targetByStaff[b] ?? 0) - (state.countByStaff[b] ?? 0));
              if (defB !== defA) return defB - defA;
              return (
                scoreCandidate(b, shift, planner, state) -
                softPenalty(b, day, shift, planner, state) -
                (scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state))
              );
            });

          if (pool.length) {
            const sid = pool[0];
            chosen.push(sid);
            slotStaff[k] = chosen;

            const dk = `${day}-${sid}`;
            state.assigned[k] = chosen;
            state.perDay[dk] = (state.perDay[dk] ?? 0) + 1;
            state.countByStaff[sid] = (state.countByStaff[sid] ?? 0) + 1;
            state.consecDays[sid] = (state.consecDays[sid] ?? 0) + 1;
            state.lastShift[sid] = { day, shift };
            changed = true;
          }
        }
      }
    }

    // สรุป violations ใหม่ แล้วเขียนทับทุกช่อง
    for (let day = 1; day <= days; day++) {
      for (const shift of ORDER) {
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
            .sort(
              (a, b) =>
                scoreCandidate(b, shift, planner, state) -
                softPenalty(b, day, shift, planner, state) -
                (scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state))
            );
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
          // เวอร์ชัน MED: ถ้า INCHARGE ในเวรนี้ถึง inMin แล้ว ให้พยายามใช้ MED ก่อน
          const poolAll = [...meds, ...incharges]
            .filter((sid) => !chosen.includes(sid))
            .filter((sid) => isHardBlocked(sid, day, shift, planner, state).length === 0)
            .sort((a, b) => {
              const icCountNow = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
              const roleRank = (sid: string) => {
                const isIC = staffMap[sid].role === 'INCHARGE';
                if (!isIC) return 0;
                return icCountNow >= inMin ? 2 : 1;
              };
              const rb = roleRank(b) - roleRank(a);
              if (rb !== 0) return rb;
              return (
                scoreCandidate(b, shift, planner, state) -
                softPenalty(b, day, shift, planner, state) -
                (scoreCandidate(a, shift, planner, state) - softPenalty(a, day, shift, planner, state))
              );
            });

          let medsAvail = poolAll.filter((sid) => staffMap[sid].role === 'MED').length;

          for (const sid of poolAll) {
            if (chosen.length >= need) break;
            const isIC = staffMap[sid].role === 'INCHARGE';
            const icCountNow = chosen.filter((id) => staffMap[id].role === 'INCHARGE').length;
            if (isIC && icCountNow >= inMax) continue;
            if (isIC && icCountNow >= inMin) {
              const remaining = need - chosen.length;
              if (medsAvail >= remaining) continue;
            }
            chosen.push(sid);
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
