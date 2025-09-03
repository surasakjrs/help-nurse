'use client';
import AuthGate from '@/components/AuthGate';
export default function AuthPage() {
  return (
    <AuthGate>
      <div className='p-6'>Signed in</div>
    </AuthGate>
  );
}
