'use client';
import AuthGate from '@/components/AuthGate';
import StaffManager from '@/components/StaffManager';
import { useParams } from 'next/navigation';

export default function StaffPage() {
  const params = useParams<{ wid: string }>();
  const wid = (params as any)?.wid as string;
  return (
    <AuthGate requireAdmin>
      <div className='space-y-4'>
        <h1 className='text-xl font-semibold'>พนักงานในสถานที่</h1>
        <StaffManager wid={wid} />
      </div>
    </AuthGate>
  );
}
