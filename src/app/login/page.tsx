'use client';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { user, signIn, signOut } = useAuth();
  return (
    <div className='max-w-md mx-auto space-y-4 flex flex-col items-center'>
      <h1 className='text-2xl font-semibold'>เข้าสู่ระบบ</h1>
      {!user ? (
        <div className='flex flex-col gap-2'>
          <button
            onClick={signIn}
            className='btn-primary'
          >
            Login with Google
          </button>
          <button
            disabled
            onClick={signIn}
            className='btn-primary opacity-50 cursor-not-allowed'
          >
            Login with Phone
          </button>
        </div>
      ) : (
        <div className='space-y-2'>
          <div>สวัสดี, {user.displayName}</div>
          {/* <button
            onClick={signOut}
            className='btn'
          >
            Logout
          </button> */}
        </div>
      )}
    </div>
  );
}
