import { addDays, eachDayOfInterval, endOfMonth, format, isSaturday, isSunday, startOfMonth } from 'date-fns';
import type { Assignment, PlanMeta, ShiftType } from '@/types/schema';

/**
 * บังคับใช้กฎ:
 * - จำนวนคนต่อเวร = demandPerShift[shift]
 * - INCHARGE อย่างน้อย 1 และไม่เกิน 2 ต่อเวร (ส่วนที่เหลือเลือก MED ก่อน)
 * - ✅ เคารพ OT “ขั้นต่ำ” ก่อน: ให้โอกาสคนที่ยัง “ขาด OT ขั้นต่ำ” มาก่อน
 * - กระจายเสาร์-อาทิตย์ให้ยุติธรรม (weekendCount น้อยมาก่อน)
 * - สูงสุด 2 เวร/วัน และห้าม NIGHT↔MORNING วันเดียวกัน
 * - เคารพวันหยุด, ห้าม M→A >2 วันติด, ห้าม A→N >2 วันติด, ห้ามทำงานติดกัน >5 วัน (เป็น “วัน”)
 */

export interface StaffLite {
  id: string;
  name: string;
  role: 'INCHARGE' | 'MED';
}
interface GenerateInput {
  meta: PlanMeta;
  staff: StaffLite[];
}

export interface AnalyseNote {
  staffId: string;
  reasons: string[];
}
export interface SlotAnalysis {
  date: string;
  shift: ShiftType;
  need: number;
  pickedIds: string[];
  missing: number;
  rejections: AnalyseNote[];
}

export function generateAssignments({ meta, staff }: GenerateInput) {
  const {
    yyyymm,
    demandPerShift,
    inchargeMin,
    inchargeMax,
    dayOff,
    mainQuota,
    /** ✅ ใช้ otMin = OT ขั้นต่ำ */
    otMin,
  } = meta;

  const year = Number(yyyymm.slice(0, 4));
  const month = Number(yyyymm.slice(4)) - 1;
  const days = eachDayOfInterval({
    start: startOfMonth(new Date(year, month, 1)),
    end: endOfMonth(new Date(year, month, 1)),
  });

  // counters
  const mainCount: Record<string, number> = Object.fromEntries(meta.staffSelected.map((id) => [id, 0]));
  const otCount: Record<string, number> = Object.fromEntries(meta.staffSelected.map((id) => [id, 0]));
  const weekendCount: Record<string, number> = Object.fromEntries(meta.staffSelected.map((id) => [id, 0]));

  // cross-day state
  const lastWorkedDate: Record<string, string | null> = Object.fromEntries(meta.staffSelected.map((id) => [id, null]));
  const consecutiveDays: Record<string, number> = Object.fromEntries(meta.staffSelected.map((id) => [id, 0]));
  const lastDayShifts: Record<string, ShiftType[]> = Object.fromEntries(meta.staffSelected.map((id) => [id, []]));
  const maStreak: Record<string, number> = Object.fromEntries(meta.staffSelected.map((id) => [id, 0]));
  const anStreak: Record<string, number> = Object.fromEntries(meta.staffSelected.map((id) => [id, 0]));

  const out: Assignment[] = [];
  const slotAnalyses: SlotAnalysis[] = [];

  const yISO = (iso: string) => format(addDays(new Date(iso), -1), 'yyyy-MM-dd');
  const shiftsOf = (dateISO: string, staffId: string) =>
    out.filter((a) => a.date === dateISO && a.staffId === staffId).map((a) => a.shift);

  function canPlaceDetailed(dateISO: string, staffId: string, shift: ShiftType): string[] {
    const reasons: string[] = [];
    const dNum = Number(dateISO.slice(-2));
    if ((dayOff[staffId] || []).includes(dNum)) reasons.push('dayOff');

    const today = shiftsOf(dateISO, staffId);
    if (today.length >= 2) reasons.push('max 2 shifts/day');
    if (shift === 'MORNING' && today.includes('NIGHT')) reasons.push('night→morning same day forbidden');
    if (shift === 'NIGHT' && today.includes('MORNING')) reasons.push('morning→night same day forbidden');

    if (today.length === 0) {
      const prev = lastWorkedDate[staffId];
      const y = yISO(dateISO);
      const nextConsec = prev === y ? (consecutiveDays[staffId] || 0) + 1 : 1;
      if (nextConsec > 5) reasons.push('>5 consecutive days');

      if (prev === y) {
        const hadM = lastDayShifts[staffId].includes('MORNING');
        const hadA = lastDayShifts[staffId].includes('AFTERNOON');
        const nextMA = hadM && shift === 'AFTERNOON' ? (maStreak[staffId] || 0) + 1 : 0;
        const nextAN = hadA && shift === 'NIGHT' ? (anStreak[staffId] || 0) + 1 : 0;
        if (nextMA > 2) reasons.push('M→A streak > 2 days');
        if (nextAN > 2) reasons.push('A→N streak > 2 days');
      }
    }
    return reasons;
  }

  function commit(staffId: string, dateISO: string, shift: ShiftType, isWkend: boolean) {
    const isOT = (mainCount[staffId] || 0) >= (mainQuota[staffId] || 0);
    out.push({ date: dateISO, shift, staffId, isOT, isWeekend: isWkend, createdAt: Date.now() });
    if (isOT) otCount[staffId] = (otCount[staffId] || 0) + 1;
    else mainCount[staffId] = (mainCount[staffId] || 0) + 1;
    if (isWkend) weekendCount[staffId] = (weekendCount[staffId] || 0) + 1;

    const today = shiftsOf(dateISO, staffId);
    if (today.length === 1) {
      const prev = lastWorkedDate[staffId];
      const y = yISO(dateISO);
      if (prev === y) {
        const hadM = lastDayShifts[staffId].includes('MORNING');
        const hadA = lastDayShifts[staffId].includes('AFTERNOON');
        maStreak[staffId] = hadM && shift === 'AFTERNOON' ? (maStreak[staffId] || 0) + 1 : 0;
        anStreak[staffId] = hadA && shift === 'NIGHT' ? (anStreak[staffId] || 0) + 1 : 0;
        consecutiveDays[staffId] = (consecutiveDays[staffId] || 0) + 1;
      } else {
        maStreak[staffId] = 0;
        anStreak[staffId] = 0;
        consecutiveDays[staffId] = 1;
      }
      lastWorkedDate[staffId] = dateISO;
      lastDayShifts[staffId] = [shift];
    } else {
      if (!lastDayShifts[staffId].includes(shift)) lastDayShifts[staffId].push(shift);
    }
  }

  /** คะแนนพื้นฐาน: คนที่ “ขาด OT ขั้นต่ำ” มาก → มาก่อน, แล้วค่อย weekend น้อย, main น้อย */
  function baseSort(isWkend: boolean) {
    return (a: StaffLite, b: StaffLite) => {
      const deficitA = Math.max(0, (otMin[a.id] || 0) - (otCount[a.id] || 0));
      const deficitB = Math.max(0, (otMin[b.id] || 0) - (otCount[b.id] || 0));
      if (deficitA !== deficitB) return deficitB - deficitA;
      if (isWkend) {
        const wa = weekendCount[a.id] || 0,
          wb = weekendCount[b.id] || 0;
        if (wa !== wb) return wa - wb;
      }
      const ma = mainCount[a.id] || 0,
        mb = mainCount[b.id] || 0;
      if (ma !== mb) return ma - mb;
      return a.id.localeCompare(b.id);
    };
  }

  /** รอบเติมให้ครบ (OT-fill) เน้นอุด “ส่วนขาด OT ขั้นต่ำ” ก่อน แล้วค่อย OT น้อย/Weekend น้อย/Main น้อย */
  function otFillSort() {
    return (a: StaffLite, b: StaffLite) => {
      const da = Math.max(0, (otMin[a.id] || 0) - (otCount[a.id] || 0));
      const db = Math.max(0, (otMin[b.id] || 0) - (otCount[b.id] || 0));
      if (da !== db) return db - da;
      const oa = otCount[a.id] || 0,
        ob = otCount[b.id] || 0;
      if (oa !== ob) return oa - ob;
      const wa = weekendCount[a.id] || 0,
        wb = weekendCount[b.id] || 0;
      if (wa !== wb) return wa - wb;
      const ma = mainCount[a.id] || 0,
        mb = mainCount[b.id] || 0;
      if (ma !== mb) return ma - mb;
      return a.id.localeCompare(b.id);
    };
  }

  for (const d of days) {
    const dateISO = format(d, 'yyyy-MM-dd');
    const isWkend = isSaturday(d) || isSunday(d);

    for (const sh of ['MORNING', 'AFTERNOON', 'NIGHT'] as const) {
      const need = Math.max(0, Number(demandPerShift?.[sh] ?? 0));
      if (need === 0) continue;

      const picked: StaffLite[] = [];
      const rejections: AnalyseNote[] = [];

      // must-have INCHARGE
      const mustIn = Math.min(Math.max(inchargeMin, 1), Math.min(inchargeMax, need));

      // 1) เลือก INCHARGE ให้ถึงขั้นต่ำ (เรียงคนที่ขาด OT ขั้นต่ำก่อน)
      const inCandidates = staff
        .filter((s) => s.role === 'INCHARGE')
        .slice()
        .sort(baseSort(isWkend));
      for (const s of inCandidates) {
        if (picked.filter((p) => p.role === 'INCHARGE').length >= mustIn) break;
        const reasons = canPlaceDetailed(dateISO, s.id, sh);
        if (reasons.length) {
          rejections.push({ staffId: s.id, reasons });
          continue;
        }
        picked.push(s);
      }

      // 2) เติมที่เหลือด้วย MED ก่อน (เรียงตาม baseSort = เคารพ OT ขั้นต่ำ)
      const medPrimary = staff
        .filter((s) => s.role === 'MED')
        .slice()
        .sort(baseSort(isWkend));
      for (const s of medPrimary) {
        if (picked.length >= need) break;
        if (picked.some((p) => p.id === s.id)) continue;
        const reasons = canPlaceDetailed(dateISO, s.id, sh);
        if (reasons.length) {
          rejections.push({ staffId: s.id, reasons });
          continue;
        }
        picked.push(s);
      }

      // 3) ถ้ายังไม่ครบ → อนุโลม INCHARGE เพิ่ม แต่ไม่เกิน inchargeMax
      if (picked.length < need) {
        const moreIn = staff
          .filter((s) => s.role === 'INCHARGE' && !picked.some((p) => p.id === s.id))
          .slice()
          .sort(baseSort(isWkend));
        for (const s of moreIn) {
          if (picked.length >= need) break;
          const nextIn = picked.filter((p) => p.role === 'INCHARGE').length + 1;
          if (nextIn > inchargeMax) continue;
          const reasons = canPlaceDetailed(dateISO, s.id, sh);
          if (reasons.length) {
            rejections.push({ staffId: s.id, reasons });
            continue;
          }
          picked.push(s);
        }
      }

      // 4) OT-fill รอบสุดท้าย: ถ้ายังไม่ครบ → เฉลี่ยตาม otFillSort (MED ก่อน → INCHARGE)
      if (picked.length < need) {
        const otMed = staff
          .filter((s) => s.role === 'MED' && !picked.some((p) => p.id === s.id))
          .slice()
          .sort(otFillSort());
        for (const s of otMed) {
          if (picked.length >= need) break;
          const reasons = canPlaceDetailed(dateISO, s.id, sh);
          if (reasons.length) {
            rejections.push({ staffId: s.id, reasons });
            continue;
          }
          picked.push(s);
        }
        if (picked.length < need) {
          const otIn = staff
            .filter((s) => s.role === 'INCHARGE' && !picked.some((p) => p.id === s.id))
            .slice()
            .sort(otFillSort());
          for (const s of otIn) {
            if (picked.length >= need) break;
            const nextIn = picked.filter((p) => p.role === 'INCHARGE').length + 1;
            if (nextIn > inchargeMax) continue;
            const reasons = canPlaceDetailed(dateISO, s.id, sh);
            if (reasons.length) {
              rejections.push({ staffId: s.id, reasons });
              continue;
            }
            picked.push(s);
          }
        }
      }

      // Safety: อย่างน้อย mustIn INCHARGE
      const haveIn = picked.filter((p) => p.role === 'INCHARGE').length;
      if (picked.length > 0 && haveIn < mustIn) {
        const incCands = staff
          .filter((s) => s.role === 'INCHARGE' && !picked.some((p) => p.id === s.id))
          .slice()
          .sort(baseSort(isWkend));
        for (const inc of incCands) {
          const reasons = canPlaceDetailed(dateISO, inc.id, sh);
          if (reasons.length) {
            rejections.push({ staffId: inc.id, reasons });
            continue;
          }
          const idxMed = picked.findIndex((p) => p.role === 'MED');
          if (idxMed >= 0) picked[idxMed] = inc;
          if (picked.filter((p) => p.role === 'INCHARGE').length >= mustIn) break;
        }
      }

      // จำกัด INCHARGE ไม่เกิน inchargeMax และจำนวนรวมไม่เกิน need
      while (picked.filter((p) => p.role === 'INCHARGE').length > inchargeMax) {
        const idx = [...picked].reverse().findIndex((p) => p.role === 'INCHARGE');
        if (idx >= 0) picked.splice(picked.length - 1 - idx, 1);
        else break;
      }
      if (picked.length > need) picked.splice(need);

      // commit
      for (const s of picked) {
        commit(s.id, dateISO, sh, isWkend);
      }

      slotAnalyses.push({
        date: dateISO,
        shift: sh,
        need,
        pickedIds: picked.map((p) => p.id),
        missing: Math.max(0, need - picked.length),
        rejections,
      });
    }
  }

  // สรุปผลต่อคน (เพื่อแสดงในหน้าวิเคราะห์/สรุป)
  const summary = Object.fromEntries(
    Object.keys(mainCount).map((id) => [
      id,
      {
        main: mainCount[id] || 0,
        ot: otCount[id] || 0,
        total: (mainCount[id] || 0) + (otCount[id] || 0),
        otMin: otMin[id] || 0,
        otDeficit: Math.max(0, (otMin[id] || 0) - (otCount[id] || 0)),
      },
    ])
  );

  return { assignments: out, mainCount, otCount, weekendCount, analysis: slotAnalyses, summary };
}
