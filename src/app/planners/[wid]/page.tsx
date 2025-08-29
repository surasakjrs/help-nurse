'use client';
import AuthGate from '@/components/AuthGate';
import PlannerEditor from '@/components/PlannerEditor';
import { useParams } from 'next/navigation';

export default function PlannerPage() {
  const params = useParams<{ wid: string }>();
  const wid = (params as any)?.wid as string;
  return (
    <AuthGate requireAdmin>
      <PlannerEditor wid={wid} />
    </AuthGate>
  );
}
