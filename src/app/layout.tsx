import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import { LoadingProvider } from '@/context/LoadingContext';
import AppHeader from '@/components/AppHeader';
import AuthLoadingBridge from '@/components/AuthLoadingBridge';
import ScrollToTopButton from '@/components/ScrollToTopButton';

export const metadata: Metadata = {
  title: 'Nurse Roster App',
  description: 'Hospital nurse shift scheduling (Next.js 15 + React 19 + Firebase v12)',
};
export const viewport: Viewport = { themeColor: '#ffffff' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang='th'
      suppressHydrationWarning
    >
      <body className='bg-zinc-100 text-zinc-900'>
        {/* ให้ overlay ครอบทั้งแอป → วาง LoadingProvider ไว้ข้างนอก */}
        <LoadingProvider>
          <AuthProvider>
            <div className='container-max p-4 min-h-dvh flex flex-col'>
              <AppHeader />
              <main className='flex-1 mt-4'>
                {children}
                <ScrollToTopButton />
              </main>
            </div>
            {/* สะพานเชื่อมโหลด auth → overlay */}
            <AuthLoadingBridge />
          </AuthProvider>
        </LoadingProvider>
      </body>
    </html>
  );
}
