'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth, googleProvider, db } from '@/lib/firebaseClient';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        return;
      }
      const ref = doc(db, 'users', u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const impliedRole: Role = envAdmins.includes(u.email?.toLowerCase() || '') ? 'ADMIN' : 'STAFF';
        const payload: UserDoc = {
          id: u.uid,
          email: u.email || '',
          displayName: u.displayName || '',
          role: impliedRole,
          createdAt: Date.now(),
        };
        await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
        setRole(impliedRole);
      } else {
        const data = snap.data() as UserDoc;
        setRole(data.role);
      }
      setLoading(false);
    });
  }, []);

  const isAdmin = useMemo(() => role === 'ADMIN', [role]);

  const signIn = async () => {
    await signInWithPopup(auth, googleProvider);
  };
  const signOut = async () => {
    await fbSignOut(auth);
  };

  return <AuthCtx.Provider value={{ user, role, isAdmin, loading, signIn, signOut }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
