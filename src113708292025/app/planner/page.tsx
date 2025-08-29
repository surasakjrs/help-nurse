'use client';
import AuthGate from '@/components/AuthGate';
import PlannerWizard from '@/components/PlannerWizard';

export default function PlannerPage() {
  return (
    <AuthGate>
      <div className='max-w-5xl mx-auto p-6 space-y-6'>
        <h1 className='text-2xl font-semibold'>วิซาร์ดจัดเวร</h1>
        <PlannerWizard />
      </div>
    </AuthGate>
  );
}
