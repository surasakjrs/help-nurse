import { NextRequest, NextResponse } from 'next/server';
import { analyseSlot } from '@/lib/analyse';
import type { ShiftType } from '@/types/schema';
import { daysIn } from '@/lib/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const SHIFTS: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];

function isValidYm(ym: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wid = String(body?.wid ?? '').trim();
    const ym = String(body?.ym ?? '').trim();
    const day = Number(body?.day);
    const shift = String(body?.shift ?? '').toUpperCase() as ShiftType;

    if (!wid) return NextResponse.json({ error: 'wid is required' }, { status: 400 });
    if (!isValidYm(ym)) return NextResponse.json({ error: 'ym must be in YYYY-MM format' }, { status: 400 });
    if (!Number.isInteger(day) || day <= 0 || day > daysIn(ym)) {
      return NextResponse.json({ error: 'day is out of range for given ym' }, { status: 400 });
    }
    if (!SHIFTS.includes(shift)) {
      return NextResponse.json({ error: 'shift must be MORNING/AFTERNOON/NIGHT' }, { status: 400 });
    }

    const result = await analyseSlot(wid, ym, day, shift);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error('analyse failed:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
