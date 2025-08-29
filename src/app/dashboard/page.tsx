'use client';
import AuthGate from '@/components/AuthGate';
import StatsDashboard from '@/components/StatsDashboard';

export default function DashboardPage() {
  return (
    <AuthGate>
      <StatsDashboard />
    </AuthGate>
  );
}
