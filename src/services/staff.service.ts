import { db } from '@/lib/firebaseClient';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { PersonColorKey, Staff, StaffRole } from '@/types/schema';

export async function addStaff(v: {
  wid: string;
  name: string;
  title?: string;
  role: StaffRole;
  active: boolean;
  color?: PersonColorKey;
}) {
  const col = collection(db, 'staff');
  await addDoc(col, { ...v, createdAt: serverTimestamp() });
}

export async function listStaff(wid: string): Promise<Staff[]> {
  const col = collection(db, 'staff');
  const q = query(col, where('wid', '==', wid), orderBy('createdAt', 'asc'));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function removeStaff(id: string) {
  await deleteDoc(doc(db, 'staff', id));
}

export async function updateStaff(id: string, patch: Partial<Staff>) {
  await updateDoc(doc(db, 'staff', id), patch as any);
}
