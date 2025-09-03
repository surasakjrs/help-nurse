'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLoading } from '@/context/LoadingContext';

function NavItem({
  href,
  children,
  active,
  hidden,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  hidden?: boolean;
  disabled?: boolean;
}) {
  if (hidden) return null;
  return (
    <Link
      href={disabled ? '#' : href}
      aria-disabled={disabled}
      className={`shadow-sm w-full btn ${active ? 'btn-active' : ''} ${
        disabled ? 'pointer-events-none opacity-60' : ''
      }`}
    >
      {children}
    </Link>
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  const { user, isAdmin, loading, signOut } = useAuth() as any;
  const { withLoading } = useLoading();

  const isActive = (p: string) => (pathname || '').startsWith(p);

  return (
    <header className='flex flex-col items-center justify-between py-3 border-b border-zinc-200'>
      <Link
        href='/'
        className='text-lg font-semibold'
      >
        Nurse Roster
      </Link>

      <nav className='flex flex-col items-center gap-2 w-full md:flex-row md:justify-end md:gap-4'>
        {/* ขวาสุด: สถานะผู้ใช้ */}
        {user ? (
          <>
            {/* เมนูที่ต้องเป็นแอดมินเท่านั้น */}
            <NavItem
              href='/workplaces'
              active={isActive('/workplaces')}
              disabled={loading}
            >
              สถานที่ทำงาน
            </NavItem>

            {/* เส้นคั่นแนวตั้งระหว่างกลุ่มเมนู */}
            <div
              aria-hidden
              className='hidden md:block w-px h-6 bg-zinc-200 mx-1'
            />

            <NavItem
              href='/planners'
              active={isActive('/planners')}
              disabled={loading}
            >
              แผนรายเดือน
            </NavItem>
            {/* <NavItem href="/dashboard" active={isActive('/dashboard')} hidden={!isAdmin} disabled={loading}>
          Dashboard
        </NavItem> */}

            {/* เส้นคั่นแนวตั้งระหว่างกลุ่มเมนู */}
            <div
              aria-hidden
              className='hidden md:block w-px h-6 bg-zinc-200 mx-1'
            />

            {/* เมนูทั่วไป */}
            <NavItem
              href='/calendar'
              active={isActive('/calendar')}
              hidden={!isAdmin}
              disabled={loading}
            >
              ปฏิทิน
            </NavItem>

            {/* เส้นคั่นแนวตั้งก่อนส่วนผู้ใช้ */}
            <div
              aria-hidden
              className='hidden md:block w-px h-6 bg-zinc-200 mx-1'
            />

            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName || 'user'}
                className='w-8 h-8 rounded-full object-cover hidden sm:block'
              />
            )}
            <span className='text-sm text-zinc-600 hidden md:block'>{user.displayName || user.email}</span>
            <button
              className='btn w-full'
              onClick={() => withLoading(() => signOut(), 'ออกจากระบบ')}
              title='Logout'
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            className={`btn ${loading ? 'pointer-events-none opacity-60' : ''}`}
            href='/login'
          >
            {loading ? (
              <span className='inline-flex items-center gap-2'>
                <span className='w-4 h-4 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin' />
                Loading…
              </span>
            ) : (
              'Login'
            )}
          </Link>
        )}
      </nav>
    </header>
  );
}
