import { NextRequest, NextResponse } from 'next/server';
import { runAutoAssign } from '@/lib/autoAssign';

export async function POST(req: NextRequest) {
  const { wid, ym, mode } = await req.json();
  const result = await runAutoAssign(wid, ym, mode);
  return NextResponse.json(result);
}
