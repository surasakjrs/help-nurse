'use client';
import AuthGate from '@/components/AuthGate';
import CalendarMonth from '@/components/CalendarMonth';

export default function CalendarPage() {
  return (
    <AuthGate>
      <CalendarMonth />
    </AuthGate>
  );
}
