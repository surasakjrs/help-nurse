'use client';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { user, signIn, signOut } = useAuth();
  return (
    <div className='max-w-md mx-auto space-y-4'>
      <h1 className='text-2xl font-semibold'>เข้าสู่ระบบ</h1>
      {!user ? (
        <button
          onClick={signIn}
          className='btn-primary'
        >
          Login with Google
        </button>
      ) : (
        <div className='space-y-2'>
          <div>สวัสดี, {user.displayName}</div>
          <button
            onClick={signOut}
            className='btn'
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
