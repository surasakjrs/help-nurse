import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseClient';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getPlanner } from '@/services/planner.service';
import { listStaff } from '@/services/staff.service';

type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export async function POST(req: NextRequest) {
  const { wid, ym, day, shift, staffIds } = (await req.json()) as {
    wid: string;
    ym: string;
    day: number;
    shift: ShiftType;
    staffIds: string[];
  };

  if (!wid || !ym || !day || !shift || !Array.isArray(staffIds)) {
    return NextResponse.json({ ok: false, error: 'invalid payload' }, { status: 400 });
  }

  const planner = await getPlanner(wid, ym);
  const demand = planner?.demand?.[shift] ?? 0;
  const inMin = Math.max(1, planner?.inchargeMinPerShift ?? 1);
  const inMax = Math.max(inMin, planner?.inchargeMaxPerShift ?? 2);
  const staff = await listStaff(wid);
  const roleMap: Record<string, 'INCHARGE' | 'MED' | 'OTHER'> = {};
  for (const s of staff) roleMap[s.id] = s.role === 'INCHARGE' || s.role === 'MED' ? s.role : 'OTHER';

  const icCount = staffIds.filter((id) => roleMap[id] === 'INCHARGE').length;
  const violations: Array<'NO_INCHARGE' | 'UNDER_STAFFED'> = [];
  if (icCount < inMin) violations.push('NO_INCHARGE');
  if ((staffIds.length ?? 0) < demand) violations.push('UNDER_STAFFED');

  const id = `${wid}-${ym}-${day}-${shift}`;
  await setDoc(
    doc(db, 'assignments', id),
    {
      wid,
      ym,
      day,
      shift,
      staffIds,
      violations,
      source: 'MANUAL',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, id, violations });
}
