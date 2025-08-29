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
  where,
} from 'firebase/firestore';

export async function createWorkplace(v: { ownerId: string; name: string; unit?: string }) {
  const col = collection(db, 'workplaces');
  const docRef = await addDoc(col, { ...v, createdAt: serverTimestamp() });
  return docRef.id;
}

export async function listWorkplacesByOwner(ownerId: string) {
  const col = collection(db, 'workplaces');
  const q = query(col, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function deleteWorkplace(id: string) {
  await deleteDoc(doc(db, 'workplaces', id));
}
