import { NextRequest } from 'next/server';
import { getAssignmentsByMonth } from '@/services/assignment.service';
import { listStaff } from '@/services/staff.service';
import { getPlanner } from '@/services/planner.service';
import type { ShiftType } from '@/types/schema';
import { daysIn } from '@/lib/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SHIFTS: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'] as const;

// แปลงชื่อเวรให้ตรงตัวอย่างภาพ
function shiftLabel(s: ShiftType) {
  if (s === 'MORNING') return 'DAY';
  if (s === 'AFTERNOON') return 'AFTERNOON';
  return 'NIGHT';
}

// ครอบค่า CSV เมื่อมีคอมม่า/อัญประกาศ/ขึ้นบรรทัดใหม่
function csvCell(raw: string) {
  const s = (raw ?? '').toString();
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function isValidYm(ym: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wid = (searchParams.get('wid') || '').trim();
  const ym = (searchParams.get('ym') || '').trim();

  if (!wid || !isValidYm(ym)) {
    return new Response('wid and ym (YYYY-MM) are required', { status: 400 });
  }

  // โหลดข้อมูลหลัก
  const [assignments, staff, planner] = await Promise.all([
    getAssignmentsByMonth(wid, ym),
    listStaff(wid),
    getPlanner(wid, ym),
  ]);

  // index assignments: day -> shift -> staffIds[]
  const idx: Record<number, Record<ShiftType, string[]>> = {};
  for (const a of assignments) {
    const day = a.day as number;
    const s = (a.shift as ShiftType) || 'MORNING';
    if (!idx[day]) idx[day] = { MORNING: [], AFTERNOON: [], NIGHT: [] };
    idx[day][s] = a.staffIds || [];
  }

  // เตรียม dayOff map: sid -> Set<number>
  const dayOffMap: Record<string, Set<number>> = {};
  const plannerDayOff = (planner?.dayOff || {}) as Record<string, number[]>;
  for (const sid of Object.keys(plannerDayOff)) {
    dayOffMap[sid] = new Set(plannerDayOff[sid] || []);
  }

  const totalDays = daysIn(ym);

  // header ตามภาพ: ช่องแรกว่าง แล้วเป็น "วันที่ 1" ... "วันที่ N"
  const header = [''].concat(Array.from({ length: totalDays }, (_, i) => `วันที่ ${i + 1}`));

  // สร้างแถวพนักงาน: เรียงตามชื่อ (active ก่อน แล้วค่อย inactive)
  const active = staff.filter((s: any) => s.active);
  const inactive = staff.filter((s: any) => !s.active);
  const staffRows = [...active, ...inactive].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'th'));

  const rows: string[][] = [header];

  for (const u of staffRows) {
    const sid = u.id as string;
    const nameRaw = (u.name || '').replace(/[\r\n]/g, ' ').trim();
    const row: string[] = [csvCell(nameRaw)]; // ✅ ครอบชื่อด้วย csvCell

    for (let d = 1; d <= totalDays; d++) {
      // หาเวรทั้งหมดของคนนี้ในวัน d
      const shiftsToday: string[] = [];
      for (const s of SHIFTS) {
        const ids = idx[d]?.[s] || [];
        if (ids.includes(sid)) shiftsToday.push(shiftLabel(s));
      }

      let cell = '';
      if (shiftsToday.length > 0) {
        // จัดลำดับ DAY -> AFTERNOON -> NIGHT แล้วคั่นด้วย ", "
        const order = { DAY: 0, AFTERNOON: 1, NIGHT: 2 } as Record<string, number>;
        cell = shiftsToday.sort((a, b) => order[a] - order[b]).join(', ');
      } else if (dayOffMap[sid]?.has(d)) {
        cell = 'DAY-OFF';
      } else {
        cell = '';
      }

      row.push(csvCell(cell)); // ✅ ครอบทุกช่อง
    }

    rows.push(row);
  }

  // สร้าง CSV (ใส่ BOM เพื่อรองรับ Excel/ภาษาไทย)
  const BOM = '\uFEFF';
  const csv = BOM + rows.map((cols) => cols.join(',')).join('\r\n');

  const fileName = `schedule-${wid}-${ym}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
