'use client';
import {
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseClient';
import type { Workplace, Staff, PlanMeta, Assignment } from '@/types/schema';

// ===== Workplaces =====
export async function addWorkplace(name: string) {
  const col = collection(db, 'workplaces');
  const ref = await addDoc(col, {
    name,
    ownerId: auth.currentUser?.uid ?? 'anonymous',
    createdAt: Date.now(),
  });
  return { id: ref.id };
}

export async function listWorkplacesByOwner(uid: string) {
  const col = collection(db, 'workplaces');
  const qy = query(col, where('ownerId', '==', uid), orderBy('createdAt', 'desc'));
  const snaps = await getDocs(qy);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workplace, 'id'>) }));
}

// ===== Staff =====
export async function addStaff(input: Omit<Staff, 'id' | 'createdAt'>) {
  const col = collection(db, 'staff');
  const ref = await addDoc(col, { ...input, createdAt: Date.now() });
  return { id: ref.id };
}

export async function listStaff(wid: string) {
  const col = collection(db, 'staff');
  const qy = query(col, where('wid', '==', wid), where('active', '==', true), orderBy('createdAt', 'asc'));
  const snaps = await getDocs(qy);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Staff, 'id'>) }));
}

// ===== Plans =====
export function planId(wid: string, yyyymm: string) {
  return `${wid}_${yyyymm}`;
}

export async function upsertPlan(meta: Omit<PlanMeta, 'id' | 'createdAt' | 'updatedAt'>) {
  const id = planId(meta.wid, meta.yyyymm);
  const ref = doc(db, 'plans', id);
  const payload: PlanMeta = {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...meta,
  };
  await setDoc(ref, payload);
  return { id };
}

export async function getPlan(wid: string, yyyymm: string) {
  const ref = doc(db, 'plans', planId(wid, yyyymm));
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as PlanMeta) : null;
}

export async function listPlansByWorkplace(wid: string) {
  const col = collection(db, 'plans');
  const qy = query(col, where('wid', '==', wid), orderBy('yyyymm', 'desc'));
  const snaps = await getDocs(qy);
  return snaps.docs.map((d) => d.data() as PlanMeta);
}

// ===== Assignments =====
export async function clearAssignments(planId: string) {
  // simple clear (client-side): read and delete one-by-one
  const col = collection(db, 'plans', planId, 'assignments');
  const snaps = await getDocs(col);
  await Promise.all(snaps.docs.map((d) => deleteDoc(d.ref)));
}

export async function addAssignment(planId: string, a: Omit<Assignment, 'createdAt'>) {
  const col = collection(db, 'plans', planId, 'assignments');
  await addDoc(col, { ...a, createdAt: Date.now() });
}

export async function listAssignments(planId: string) {
  const col = collection(db, 'plans', planId, 'assignments');
  const snaps = await getDocs(col);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as Assignment) }));
}
