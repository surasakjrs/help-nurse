'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { auth, googleProvider } from '@/lib/firebaseClient'
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth'


interface AuthCtx {
user: User | null
signInGoogle: () => Promise<void>
signOutApp: () => Promise<void>
}


const Ctx = createContext<AuthCtx | null>(null)


export function AuthProvider({ children }: { children: React.ReactNode }){
const [user, setUser] = useState<User|null>(null)


useEffect(() => {
return onAuthStateChanged(auth, (u) => setUser(u))
}, [])


const signInGoogle = async () => {
await signInWithPopup(auth, googleProvider)
}


const signOutApp = async () => { await signOut(auth) }


return <Ctx.Provider value={{ user, signInGoogle, signOutApp }}>{children}</Ctx.Provider>
}


export const useAuth = () => {
const v = useContext(Ctx)
if (!v) throw new Error('useAuth outside provider')
return v
}