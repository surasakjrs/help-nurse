import './globals.css';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { LoadingProvider } from '@/context/LoadingContext';

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
              <header className='flex items-center justify-between py-3'>
                <a
                  href='/'
                  className='text-lg font-semibold'
                >
                  Nurse Roster
                </a>
                <nav className='flex gap-2'>
                  <a
                    className='btn'
                    href='/workplaces'
                  >
                    สถานที่ทำงาน
                  </a>
                  <a
                    className='btn'
                    href='/planners'
                  >
                    แผนรายเดือน
                  </a>
                  <a
                    className='btn'
                    href='/calendar'
                  >
                    ปฏิทิน
                  </a>
                  <a
                    className='btn'
                    href='/dashboard'
                  >
                    Dashboard
                  </a>
                  <a
                    className='btn'
                    href='/login'
                  >
                    Login
                  </a>
                </nav>
              </header>
              {children}
            </div>
          </LoadingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
