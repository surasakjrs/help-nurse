import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseClient';
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  const { wid, ym, onlyAuto = true } = await req.json();

  if (!wid || !ym) {
    return NextResponse.json({ ok: false, error: 'wid and ym required' }, { status: 400 });
  }

  const col = collection(db, 'assignments');
  const filters: any[] = [where('wid', '==', wid), where('ym', '==', ym)];
  if (onlyAuto) filters.push(where('source', '==', 'AUTO'));

  const q = query(col, ...filters);
  const snaps = await getDocs(q);

  for (const d of snaps.docs) {
    await deleteDoc(d.ref);
  }

  return NextResponse.json({ ok: true, count: snaps.size });
}
