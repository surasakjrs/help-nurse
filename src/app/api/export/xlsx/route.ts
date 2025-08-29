import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { getAssignmentsByMonth } from '@/services/assignment.service';
import { listStaff } from '@/services/staff.service';
import { getPlanner } from '@/services/planner.service';
import type { ShiftType } from '@/types/schema';
import { daysIn } from '@/lib/util';

export const runtime = 'nodejs';

const SHIFTS: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];

function shiftLabel(s: ShiftType) {
  if (s === 'MORNING') return 'DAY';
  if (s === 'AFTERNOON') return 'AFTERNOON';
  return 'NIGHT';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wid = searchParams.get('wid') || '';
  const ym = searchParams.get('ym') || '';

  if (!wid || !ym) return new Response('wid and ym are required', { status: 400 });

  const [assignments, staff, planner] = await Promise.all([
    getAssignmentsByMonth(wid, ym),
    listStaff(wid),
    getPlanner(wid, ym),
  ]);

  // day -> shift -> staffIds[]
  const idx: Record<number, Record<ShiftType, string[]>> = {};
  for (const a of assignments) {
    if (!idx[a.day]) idx[a.day] = { MORNING: [], AFTERNOON: [], NIGHT: [] };
    const s = (a.shift as ShiftType) || 'MORNING';
    idx[a.day][s] = a.staffIds || [];
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

  // ทำ workbook/sheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

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

  // Freeze header row + name column (ถ้าคลายไม่ได้ก็ไม่เป็นไร)
  (ws as any)['!freeze'] = { xSplit: 1, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, 'Schedule');

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
