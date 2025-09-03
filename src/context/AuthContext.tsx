'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth, googleProvider, db } from '@/lib/firebaseClient';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, signInWithRedirect } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import type { Role, UserDoc } from '@/types/schema';

type Ctx = {
  user: any | null;
  role: Role | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  role: null,
  isAdmin: false,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

const envAdmins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminFlag, setAdminFlag] = useState<boolean>(false); // ✅ คำนวณ isAdmin จากหลายแหล่ง

  useEffect(() => {
    // onAuthStateChanged จะยิงครั้งแรกเสมอ → ใช้ภายในเป็นที่เดียวที่อัปเดต state
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setAdminFlag(false);
        // setLoading(false);
        return;
      }

      // 1) ดึง/สร้างเอกสารผู้ใช้
      const ref = doc(db, 'users', u.uid);
      const snap = await getDoc(ref);

      let currentRole: Role;
      if (!snap.exists()) {
        const impliedRole: Role = envAdmins.includes(u.email?.toLowerCase() || '') ? 'ADMIN' : 'STAFF';
        const payload: UserDoc = {
          id: u.uid,
          email: u.email || '',
          displayName: u.displayName || '',
          role: impliedRole,
          createdAt: Date.now(),
        };
        // createdAt บนเซิร์ฟเวอร์
        await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
        currentRole = impliedRole;
      } else {
        const data = snap.data() as UserDoc;
        currentRole = data.role;
      }
      setRole(currentRole);

      // 2) ตรวจสิทธิ์แอดมินจากหลายที่
      const envAdmin = envAdmins.includes(u.email?.toLowerCase() || '');

      let docAdmin = false;
      try {
        const a = await getDoc(doc(db, 'admins', u.uid));
        docAdmin = a.exists();
      } catch {
        docAdmin = false;
      }

      let workplaceAdmin = false;
      try {
        // เป็นแอดมินของสถานที่ใดสถานที่หนึ่ง (field: admins: string[])
        const q = query(collection(db, 'workplaces'), where('admins', 'array-contains', u.uid));
        const snaps = await getDocs(q);
        workplaceAdmin = snaps.size > 0;
      } catch {
        workplaceAdmin = false;
      }

      setAdminFlag(currentRole === 'ADMIN' || envAdmin || docAdmin || workplaceAdmin);

      // setLoading(false);
    });
  }, []);

  // isAdmin สรุปจาก adminFlag (ไม่พึ่ง role อย่างเดียวอีกต่อไป)
  const isAdmin = useMemo(() => adminFlag, [adminFlag]);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      // Popup blocked or disallowed → use redirect (works well on mobile)
      await signInWithRedirect(auth, googleProvider);
    }
  };
  const signOut = async () => {
    await fbSignOut(auth);
  };

  return <AuthCtx.Provider value={{ user, role, isAdmin, loading, signIn, signOut }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
