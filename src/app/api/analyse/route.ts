import { NextRequest, NextResponse } from 'next/server';
import { analyseSlot } from '@/lib/analyse';

export async function POST(req: NextRequest) {
  const { wid, ym, day, shift } = await req.json();
  const result = await analyseSlot(wid, ym, day, shift);
  return NextResponse.json(result);
}
