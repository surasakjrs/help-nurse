'use client';
import AuthGate from '@/components/AuthGate';
import WorkplaceForm from '@/components/WorkplaceForm';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createWorkplace, deleteWorkplace, listWorkplacesByOwner } from '@/services/workplaces.service';
import Link from 'next/link';

type W = { id: string; name: string; unit?: string };

export default function WorkplacesPage() {
  return (
    <AuthGate requireAdmin>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { user } = useAuth();
  const [items, setItems] = useState<W[]>([]);

  const refresh = () => {
    if (!user) return;
    listWorkplacesByOwner(user.uid).then(setItems as any);
  };
  useEffect(() => {
    refresh();
  }, [user]);

  return (
    <div className='space-y-6'>
      <h1 className='text-xl font-semibold'>สถานที่ทำงานของฉัน</h1>
      <WorkplaceForm
        onSubmit={async (v) => {
          if (!user) return;
          await createWorkplace({ ownerId: user.uid, ...v });
          refresh();
        }}
      />
      <div className='card p-4'>
        <table className='table'>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>หน่วย</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td>{w.unit || '-'}</td>
                <td className='text-right'>
                  <Link
                    className='btn mr-2'
                    href={`/workplaces/${w.id}`}
                  >
                    จัดการพนักงาน
                  </Link>
                  <Link
                    className='btn mr-2'
                    href={`/planners/${w.id}`}
                  >
                    แผนรายเดือน
                  </Link>
                  <button
                    className='btn'
                    onClick={() => deleteWorkplace(w.id).then(refresh)}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
