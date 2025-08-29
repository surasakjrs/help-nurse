'use client'
import { useAuth } from '@/context/AuthContext'


export default function AuthGate({ children }: { children: React.ReactNode }){
const { user, signInGoogle, signOutApp } = useAuth()
if (!user) return (
<div className="min-h-[60vh] grid place-items-center">
<div className="card p-8 space-y-4 text-center">
<h1 className="text-xl font-semibold">เข้าสู่ระบบ</h1>
<button className="btn btn-primary" onClick={signInGoogle}>Sign in with Google</button>
</div>
</div>
)
return (
<div>
<div className="flex items-center justify-between p-4">
<div className="text-sm text-zinc-600">สวัสดี, {user.displayName || user.email}</div>
<button className="btn" onClick={signOutApp}>ออกจากระบบ</button>
</div>
{children}
</div>
)
}