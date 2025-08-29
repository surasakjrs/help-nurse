import { db } from '@/lib/firebaseClient';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';

export async function getAssignmentsByMonth(wid: string, ym: string) {
  const col = collection(db, 'assignments');
  const q = query(col, where('wid', '==', wid), where('ym', '==', ym), orderBy('day', 'asc'), orderBy('shift', 'asc'));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}
