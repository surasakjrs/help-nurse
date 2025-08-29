import './globals.css';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { LoadingProvider } from '@/context/LoadingContext';
import AppHeader from '@/components/AppHeader';

export const metadata = {
  title: 'Nurse Roster App',
  description: 'Hospital nurse shift scheduling (Next.js 15 + React 19 + Firebase v12)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='th'>
      <body>
        <AuthProvider>
          <LoadingProvider>
            <div className='container-max p-4'>
              <AppHeader />
              {children}
            </div>
          </LoadingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
