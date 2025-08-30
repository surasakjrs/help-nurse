import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { getAssignmentsByMonth } from '@/services/assignment.service';
import { listStaff } from '@/services/staff.service';
import { getPlanner } from '@/services/planner.service';
import type { ShiftType } from '@/types/schema';
import { daysIn } from '@/lib/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SHIFTS: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];

function shiftLabel(s: ShiftType) {
  if (s === 'MORNING') return 'DAY';
  if (s === 'AFTERNOON') return 'AFTERNOON';
  return 'NIGHT';
}

function isValidYm(ym: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wid = (searchParams.get('wid') || '').trim();
  const ym = (searchParams.get('ym') || '').trim();

  if (!wid || !isValidYm(ym)) return new Response('wid and ym (YYYY-MM) are required', { status: 400 });

  const [assignments, staff, planner] = await Promise.all([
    getAssignmentsByMonth(wid, ym),
    listStaff(wid),
    getPlanner(wid, ym),
  ]);

  // day -> shift -> staffIds[]
  const idx: Record<number, Record<ShiftType, string[]>> = {};
  for (const a of assignments) {
    const day = a.day as number;
    const s = (a.shift as ShiftType) || 'MORNING';
    if (!idx[day]) idx[day] = { MORNING: [], AFTERNOON: [], NIGHT: [] };
    idx[day][s] = a.staffIds || [];
  }

  // dayOff sid -> Set<day>
  const dayOffMap: Record<string, Set<number>> = {};
  const plannerDayOff = (planner?.dayOff || {}) as Record<string, number[]>;
  for (const sid of Object.keys(plannerDayOff)) dayOffMap[sid] = new Set(plannerDayOff[sid] || []);

  const totalDays = daysIn(ym);

  // header: '', 'วันที่ 1'...'วันที่ N'
  const header = [''].concat(Array.from({ length: totalDays }, (_, i) => `วันที่ ${i + 1}`));

  // เรียงชื่อ: active ก่อน, ตามด้วย inactive
  const active = staff.filter((s: any) => s.active);
  const inactive = staff.filter((s: any) => !s.active);
  const staffRows = [...active, ...inactive].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'th'));

  // --------- Sheet 1: Schedule ---------
  const rows: (string | number)[][] = [header];

  for (const u of staffRows) {
    const sid = u.id as string;
    const name = (u.name || '').replace(/[\r\n]/g, ' ').trim();
    const row: string[] = [name];

    for (let d = 1; d <= totalDays; d++) {
      const shiftsToday: string[] = [];
      for (const s of SHIFTS) {
        const ids = idx[d]?.[s] || [];
        if (ids.includes(sid)) shiftsToday.push(shiftLabel(s));
      }

      let cell = '';
      if (shiftsToday.length) {
        const order: Record<string, number> = { DAY: 0, AFTERNOON: 1, NIGHT: 2 };
        cell = shiftsToday.sort((a, b) => order[a] - order[b]).join(', ');
      } else if (dayOffMap[sid]?.has(d)) {
        cell = 'DAY-OFF';
      }
      row.push(cell);
    }

    rows.push(row);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Autofilter ทั้งตาราง + Freeze แถวหัว & คอลัมน์ชื่อ
  const range = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length - 1, c: header.length - 1 },
  });
  (ws as any)['!autofilter'] = { ref: range };
  (ws as any)['!freeze'] = { xSplit: 1, ySplit: 1 };

  // ความกว้างคอลัมน์พออ่านง่าย
  const colWidths = rows[0].map((_, ci) => {
    let maxLen = 4;
    for (let r = 0; r < rows.length; r++) {
      const v = (rows[r][ci] ?? '').toString();
      maxLen = Math.max(maxLen, v.length);
    }
    return { wch: Math.min(28, Math.max(8, maxLen + 2)) };
  });
  (ws as any)['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, `Schedule ${ym}`);

  // --------- Sheet 2: Summary (Base / OT / Min OT / Deficit) ---------
  const countMap: Record<string, number> = {};
  for (const a of assignments) {
    for (const sid of a.staffIds || []) {
      countMap[sid] = (countMap[sid] ?? 0) + 1;
    }
  }

  const summaryHeader = [
    'ชื่อ',
    'บทบาท',
    'Base (แผน)',
    'OT ขั้นต่ำ',
    'ทำจริง',
    'เวรหลัก',
    'OT ทำจริง',
    'ขาด/เกิน OT ขั้นต่ำ',
  ];
  const summaryRows: (string | number)[][] = [summaryHeader];

  for (const u of staffRows) {
    const sid = u.id as string;
    const name = (u.name || '').replace(/[\r\n]/g, ' ').trim();
    const role = u.role;
    const total = countMap[sid] ?? 0;
    const base = planner?.baseShifts?.[sid] ?? 0;
    const minOT = planner?.minOT?.[sid] ?? 0;
    const main = Math.min(total, base);
    const ot = Math.max(0, total - base);
    const deficit = minOT - ot; // อาจติดลบได้ = เกินขั้นต่ำ

    summaryRows.push([name, role, base, minOT, total, main, ot, deficit]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  const range2 = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: summaryRows.length - 1, c: summaryHeader.length - 1 },
  });
  (ws2 as any)['!autofilter'] = { ref: range2 };
  (ws2 as any)['!freeze'] = { xSplit: 1, ySplit: 1 };

  const colWidths2 = summaryHeader.map((_, ci) => {
    let maxLen = 4;
    for (let r = 0; r < summaryRows.length; r++) {
      const v = (summaryRows[r][ci] ?? '').toString();
      maxLen = Math.max(maxLen, v.length);
    }
    // ชื่อให้กว้างขึ้นหน่อย
    const baseW = ci === 0 ? 32 : 16;
    return { wch: Math.max(baseW, Math.min(40, maxLen + 2)) };
  });
  (ws2 as any)['!cols'] = colWidths2;

  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  // --------- ส่งไฟล์ ---------
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  const fileName = `schedule-${wid}-${ym}.xlsx`;

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
