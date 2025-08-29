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
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <Link
      href={href}
      className={`btn ${active ? 'btn-active' : ''}`}
    >
      {children}
    </Link>
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  const { user, isAdmin, loading, logout } = useAuth();
  const { withLoading } = useLoading();

  const isActive = (p: string) => (pathname || '').startsWith(p);

  return (
    <header className='flex items-center justify-between py-3'>
      <Link
        href='/'
        className='text-lg font-semibold'
      >
        Nurse Roster
      </Link>

      <nav className='flex items-center gap-2'>
        {/* เมนูที่ต้องเป็นแอดมินเท่านั้น */}
        <NavItem
          href='/workplaces'
          active={isActive('/workplaces')}
          hidden={!isAdmin}
        >
          สถานที่ทำงาน
        </NavItem>
        <NavItem
          href='/planners'
          active={isActive('/planners')}
          hidden={!isAdmin}
        >
          แผนรายเดือน
        </NavItem>
        {/* <NavItem
          href='/dashboard'
          active={isActive('/dashboard')}
          hidden={!isAdmin}
        >
          Dashboard
        </NavItem> */}

        {/* เมนูทั่วไป */}
        <NavItem
          href='/calendar'
          active={isActive('/calendar')}
        >
          ปฏิทิน
        </NavItem>

        {/* ขวาสุด: สถานะผู้ใช้ */}
        {user ? (
          <>
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName || 'user'}
                className='w-8 h-8 rounded-full object-cover hidden sm:block'
              />
            )}
            <span className='text-sm text-zinc-600 hidden md:block'>{user.displayName || user.email}</span>
            <button
              className='btn'
              onClick={() => withLoading(() => logout(), 'ออกจากระบบ')}
              title='Logout'
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            className='btn'
            href='/login'
          >
            {loading ? 'Loading…' : 'Login'}
          </Link>
        )}
      </nav>
    </header>
  );
}
