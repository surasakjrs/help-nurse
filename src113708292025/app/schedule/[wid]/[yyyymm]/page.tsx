import { use } from 'react';
import AuthGate from '@/components/AuthGate';
import ShiftCalendar from '@/components/ShiftCalendar';
import ShiftLegend from '@/components/ShiftLegend';

export default function SchedulePage({ params }: { params: Promise<{ wid: string; yyyymm: string }> }) {
  const { wid, yyyymm } = use(params);
  return (
    <AuthGate>
      <div className='max-w-6xl mx-auto p-6 space-y-4'>
        <h1 className='text-2xl font-semibold'>
          ตารางเวร: {wid} · {yyyymm}
        </h1>
        <ShiftLegend />
        <ShiftCalendar
          wid={wid}
          yyyymm={yyyymm}
        />
      </div>
    </AuthGate>
  );
}
