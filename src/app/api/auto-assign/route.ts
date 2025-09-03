import { NextRequest, NextResponse } from 'next/server';
// import { runAutoAssign } from '@/lib/autoAssign';
import { runAutoAssign } from '@/lib/autoAssign.nmfix';

export const runtime = 'nodejs'; // ใช้ Node runtime สำหรับงานหนัก
export const dynamic = 'force-dynamic'; // ไม่ cache
export const revalidate = 0;
// ถ้าใช้ Vercel: เพิ่ม maxDuration เพื่อกัน timeout งานยาว (ปรับตามแผน)
export const maxDuration = 60;

type Mode = 'ALL' | 'INCHARGE' | 'MED';

function isValidYm(ym: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wid = String(body?.wid ?? '').trim();
    const ym = String(body?.ym ?? '').trim();
    const rawMode = String(body?.mode ?? '').toUpperCase() as Mode;

    let mode: Mode = ['ALL', 'INCHARGE', 'MED'].includes(rawMode) ? rawMode : 'ALL';

    if (!wid) {
      return NextResponse.json({ error: 'wid is required' }, { status: 400 });
    }
    if (!ym || !isValidYm(ym)) {
      return NextResponse.json({ error: 'ym must be in YYYY-MM format' }, { status: 400 });
    }

    // ถ้า “ไม่ต้องแยกปุ่ม auto assign แล้ว” ต้องการให้รัน ALL เสมอ เปิดบรรทัดด้านล่าง:
    // mode = 'ALL';

    const result = await runAutoAssign(wid, ym, mode);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error('auto-assign failed:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
