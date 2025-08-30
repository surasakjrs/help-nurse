'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLoading } from '@/context/LoadingContext';

export default function AuthGate({ children, requireAdmin }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, isAdmin, loading } = useAuth();
  const { start, stop } = useLoading();

  // กัน stop() โดยไม่ได้ start() จากคอมโพเนนต์นี้
  const startedRef = useRef(false);

  useEffect(() => {
    if (loading && !startedRef.current) {
      start('กำลังตรวจสอบสิทธิ์');
      startedRef.current = true;
    } else if (!loading && startedRef.current) {
      stop();
      startedRef.current = false;
    }
    return () => {
      if (startedRef.current) {
        stop();
        startedRef.current = false;
      }
    };
  }, [loading, start, stop]);

  if (loading) return null; // ใช้ overlay จาก LoadingProvider

  if (!user) {
    return (
      <div className='max-w-lg mx-auto space-y-4'>
        <h1 className='text-xl font-semibold'>กรุณาเข้าสู่ระบบ</h1>
        <Link
          href='/login'
          className='btn-primary'
        >
          ไปหน้า Login
        </Link>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return <div className='max-w-lg mx-auto'>คุณไม่มีสิทธิ์เข้าหน้านี้</div>;
  }

  return <>{children}</>;
}
