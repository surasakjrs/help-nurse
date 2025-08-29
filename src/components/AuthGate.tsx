'use client';
import { useAuth } from '@/context/AuthContext';
import { useLoading } from '@/context/LoadingContext';
import { useEffect } from 'react';

export default function AuthGate({ children, requireAdmin }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, isAdmin, loading } = useAuth();

  const { start, stop } = useLoading();

  useEffect(() => {
    if (loading) start('กำลังตรวจสอบสิทธิ์');
    else stop();
    return () => stop();
  }, [loading, start, stop]);

  if (loading) return null;

  if (!user) {
    return (
      <div className='max-w-lg mx-auto space-y-4'>
        <h1 className='text-xl font-semibold'>กรุณาเข้าสู่ระบบ</h1>
        <a
          href='/login'
          className='btn-primary'
        >
          ไปหน้า Login
        </a>
      </div>
    );
  }
  if (requireAdmin && !isAdmin) {
    return <div className='max-w-lg mx-auto'>คุณไม่มีสิทธิ์เข้าหน้านี้</div>;
  }
  return <>{children}</>;
}
