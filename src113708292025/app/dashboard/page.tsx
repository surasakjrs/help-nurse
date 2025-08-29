'use client';
import AuthGate from '@/components/AuthGate';
import MonthPicker from '@/components/MonthPicker';
import WorkplaceSelect from '@/components/WorkplaceSelect';
import QuickSetup from '@/components/QuickSetup';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [wid, setWid] = useState('');
  const [yyyymm, setYyyymm] = useState(() => new Date().toISOString().slice(0, 7).replace('-', ''));
  const router = useRouter();

  return (
    <AuthGate>
      <div className='max-w-4xl mx-auto p-6 space-y-6'>
        <h1 className='text-2xl font-semibold'>Dashboard</h1>

        {/* ช็อตคัตเปิด Planner / Schedule */}
        <div className='card p-4 grid gap-3 md:grid-cols-3'>
          <div>
            <div className='label mb-1'>สถานที่ทำงาน</div>
            <WorkplaceSelect
              value={wid}
              onChange={setWid}
            />
          </div>
          <div>
            <div className='label mb-1'>เลือกเดือน</div>
            <MonthPicker
              value={yyyymm}
              onChange={setYyyymm}
            />
          </div>
          <div className='flex items-end gap-2'>
            <button
              className='btn'
              onClick={() => router.push('/planner')}
            >
              เปิดวิซาร์ดจัดเวร
            </button>
            <button
              disabled={!wid}
              className='btn btn-primary'
              onClick={() => router.push(`/schedule/${wid}/${yyyymm}`)}
            >
              เปิดปฏิทิน
            </button>
          </div>
        </div>

        {/* QuickSetup: ผูกเข้ากับ Dashboard ตรงนี้ */}
        <div className='space-y-3'>
          <h2 className='text-lg font-semibold'>ตั้งค่าที่ทำงานแบบด่วน</h2>
          <QuickSetup />
        </div>
      </div>
    </AuthGate>
  );
}
