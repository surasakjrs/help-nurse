import type { Planner, ShiftType, Staff } from '@/types/schema';
import { getPlanner } from '@/services/planner.service';
import { listStaff } from '@/services/staff.service';
import { getAssignmentsByMonth } from '@/services/assignment.service';

type RoleKey = 'INCHARGE' | 'MED';

const ORDER: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];
const sortShift = (a: ShiftType, b: ShiftType) => ORDER.indexOf(a) - ORDER.indexOf(b);

export async function analyseSlot(wid: string, ym: string, day: number, shift: ShiftType) {
  const planner = (await getPlanner(wid, ym)) as Planner;
  const staff = (await listStaff(wid)) as Staff[];
  const assigns = await getAssignmentsByMonth(wid, ym);

  // --- Index ---
  const byDayShift: Record<string, string[]> = {};
  const byDayByStaff: Record<string, ShiftType[]> = {};
  const workedDaysByStaff: Record<string, Set<number>> = {};
  for (const a of assigns) {
    const k = `${a.day}-${a.shift}`;
    byDayShift[k] = a.staffIds || [];
    for (const sid of a.staffIds || []) {
      const dk = `${a.day}-${sid}`;
      (byDayByStaff[dk] ||= []).push(a.shift as ShiftType);
      (workedDaysByStaff[sid] ||= new Set()).add(a.day);
    }
  }

  const demand = planner.demand;
  const need = demand[shift];
  const assignedNow = byDayShift[`${day}-${shift}`] || [];
  const slotFull = assignedNow.length >= need;

  const inMin = Math.max(1, planner.inchargeMinPerShift ?? 1);
  const inMax = Math.max(inMin, planner.inchargeMaxPerShift ?? 2);
  const inAssigned = (assignedNow || []).filter((id) => staff.find((s) => s.id === id)?.role === 'INCHARGE').length;

  const dayOffOf = (sid: string) => new Set(planner.dayOff[sid] || []);
  const perDayCount = (sid: string, d: number) => (byDayByStaff[`${d}-${sid}`] || []).length;
  const shiftsOf = (sid: string, d: number): ShiftType[] => (byDayByStaff[`${d}-${sid}`] || []).slice().sort(sortShift);

  const primaryShiftOfPrevDay = (sid: string, d: number): ShiftType | null => {
    const s = shiftsOf(sid, d);
    if (!s.length) return null;
    return s[0]; // เลือกตัวแรกเป็น primary (M < A < N)
  };

  const consecutiveDaysUpTo = (sid: string, upto: number): number => {
    const days = Array.from((workedDaysByStaff[sid] || new Set()).values()).sort((a, b) => a - b);
    let run = 0;
    for (let d = upto; d >= 1; d--) {
      if (days.includes(d)) run += 1;
      else break;
    }
    return run;
  };

  const dayPairKey = (sid: string, d: number): string | null => {
    const s = shiftsOf(sid, d);
    if (s.length !== 2) return null;
    return `${s[0]}+${s[1]}`;
  };

  const pairRunLenUpTo = (sid: string, upto: number, pairKey: string): number => {
    let run = 0;
    for (let d = upto; d >= 1; d--) {
      if (dayPairKey(sid, d) === pairKey) run += 1;
      else break;
    }
    return run;
  };

  const score = (sid: string): number => {
    const base = planner.baseShifts[sid] || 0;
    const prefs = planner.preferences[sid] || {};
    const pref = prefs[shift] ?? 0.5;
    const already = assigns.reduce((acc, a) => acc + (a.staffIds?.includes(sid) ? 1 : 0), 0);
    const remaining = Math.max(0, base - already);
    return pref * 0.5 + remaining * 0.5;
  };

  const hardViolations = (s: Staff): string[] => {
    const vs: string[] = [];
    if (slotFull) vs.push('ช่องนี้คนครบตามความต้องการแล้ว');
    if ((perDayCount(s.id, day) ?? 0) >= 2) vs.push('ครบ 2 เวร/วันแล้ว');
    if (dayOffOf(s.id).has(day)) vs.push('เป็นวันหยุดของพนักงาน');

    const prevPrimary = primaryShiftOfPrevDay(s.id, day - 1);
    if (prevPrimary === 'NIGHT' && shift === 'MORNING') vs.push('ห้าม NIGHT→MORNING วันถัดไป');

    if (consecutiveDaysUpTo(s.id, day - 1) >= 5) vs.push('ทำงานติดกันเกิน 5 วัน');

    // NEW hard rule: ห้าม 2 เวร/วันคู่เดิม ซ้ำติดกันเกิน 3 วัน
    const todayCount = perDayCount(s.id, day);
    if (todayCount === 1) {
      const existing = shiftsOf(s.id, day)[0]!;
      const pair = [existing, shift].sort(sortShift) as [ShiftType, ShiftType];
      const pk = `${pair[0]}+${pair[1]}`;
      const run = pairRunLenUpTo(s.id, day - 1, pk);
      if (run >= 3) vs.push('ห้าม 2 เวรคู่เดิมซ้ำเกิน 3 วันติด');
    }

    if (assignedNow.includes(s.id)) vs.push('อยู่ในเวรนี้อยู่แล้ว');

    return vs;
  };

  const byRole = (role: RoleKey) =>
    staff
      .filter((s) => s.active && s.role === role)
      .map((s) => {
        const reasons = hardViolations(s);
        if (role === 'INCHARGE' && reasons.length === 0) {
          if (inAssigned >= inMax) reasons.push(`INCHARGE ในเวรนี้ครบเพดาน ${inMax} คนแล้ว`);
        }
        return { staff: s, reasons };
      });

  const collect = (role: RoleKey) => {
    const rows = byRole(role);
    const can = rows
      .filter((r) => r.reasons.length === 0)
      .map((r) => ({ id: r.staff.id, name: r.staff.name, score: score(r.staff.id) }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const cannot = rows
      .filter((r) => r.reasons.length > 0)
      .map((r) => ({ id: r.staff.id, name: r.staff.name, reasons: r.reasons }));
    return { can, cannot };
  };

  return {
    slot: {
      wid,
      ym,
      day,
      shift,
      demand: need,
      assignedIds: assignedNow,
      inchargeCount: inAssigned,
      inchargeMin: inMin,
      inchargeMax: inMax,
    },
    INCHARGE: collect('INCHARGE'),
    MED: collect('MED'),
  };
}
