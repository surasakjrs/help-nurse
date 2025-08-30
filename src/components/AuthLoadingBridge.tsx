'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLoading } from '@/context/LoadingContext';

export default function AuthLoadingBridge() {
  const { loading } = useAuth();
  const { start, stop } = useLoading();
  const startedRef = useRef(false);

  useEffect(() => {
    if (loading && !startedRef.current) {
      start('กำลังโหลดข้อมูลผู้ใช้');
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

  return null;
}
