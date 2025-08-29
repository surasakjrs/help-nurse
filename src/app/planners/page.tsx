'use client';
import AuthGate from '@/components/AuthGate';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { listWorkplacesByOwner } from '@/services/workplaces.service';
import Link from 'next/link';

export default function PlannersIndex() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (user) listWorkplacesByOwner(user.uid).then(setItems);
  }, [user]);
  return (
    <AuthGate requireAdmin>
      <div className='space-y-4'>
        <h1 className='text-xl font-semibold'>เลือกสถานที่เพื่อจัดแผนรายเดือน</h1>
        <ul className='list-disc pl-6'>
          {items.map((w) => (
            <li key={w.id}>
              <Link
                className='underline'
                href={`/planners/${w.id}`}
              >
                {w.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AuthGate>
  );
}
