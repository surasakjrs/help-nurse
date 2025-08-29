import { db } from '@/lib/firebaseClient';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Planner } from '@/types/schema';

export async function getPlanner(wid: string, ym: string): Promise<Planner> {
  const id = `${wid}-${ym}`;
  const ref = doc(db, 'planners', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return {
      wid,
      ym,
      demand: { MORNING: 4, AFTERNOON: 4, NIGHT: 4 },
      baseShifts: {},
      minOT: {},
      dayOff: {},
      preferences: {},
      inchargeMinPerShift: 1,
      inchargeMaxPerShift: 2,
    };
  }
  const data = snap.data() as Planner;
  return { ...data, wid, ym };
}

export async function savePlanner(p: Planner) {
  const id = `${p.wid}-${p.ym}`;
  const ref = doc(db, 'planners', id);
  await setDoc(ref, { ...p, updatedAt: serverTimestamp() });
}
