// app/api/assignments/clear/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseClient';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

function isValidYm(ym: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wid = String(body?.wid ?? '').trim();
    const ym = String(body?.ym ?? '').trim();
    const onlyAuto: boolean = body?.onlyAuto !== false; // ค่าเริ่มต้น: ล้างเฉพาะ AUTO

    if (!wid) return NextResponse.json({ ok: false, error: 'wid is required' }, { status: 400 });
    if (!isValidYm(ym)) {
      return NextResponse.json({ ok: false, error: 'ym must be in YYYY-MM format' }, { status: 400 });
    }

    const filters: any[] = [where('wid', '==', wid), where('ym', '==', ym)];
    if (onlyAuto) filters.push(where('source', '==', 'AUTO'));

    const q = query(collection(db, 'assignments'), ...filters);
    const snaps = await getDocs(q);

    if (snaps.empty) {
      return NextResponse.json({ ok: true, count: 0, deleted: [], onlyAuto });
    }

    // ลบแบบ batch (กันเกิน 500 ops)
    let batch = writeBatch(db);
    let ops = 0;
    let count = 0;
    const deleted: string[] = [];

    for (const d of snaps.docs) {
      batch.delete(d.ref);
      ops += 1;
      count += 1;
      deleted.push(d.id);

      if (ops >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();

    return NextResponse.json({ ok: true, count, deleted, onlyAuto });
  } catch (err: any) {
    console.error('assignments/clear error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
