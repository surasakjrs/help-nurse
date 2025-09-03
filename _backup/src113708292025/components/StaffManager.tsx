'use client';
import { useEffect, useState } from 'react';
import { addStaff, listStaff } from '@/services/firestore';
import type { Role } from '@/types/schema';

export default function StaffManager({ wid }: { wid: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<Role>('MED');

  // const refresh = () => listStaff(wid).then(setItems);
  const refresh = () => {
    if (!wid) return;
    listStaff(wid).then(setItems).catch(console.error);
  };
  useEffect(refresh, [wid]);

  const onAdd = async () => {
    await addStaff({ wid, name, title, role, active: true });
    // setName('');
    // setTitle('');
    setRole('INCHARGE');
    refresh();
  };

  return (
    <div className='card p-4 space-y-4'>
      <div className='grid md:grid-cols-4 gap-2'>
        <input
          className='input'
          placeholder='ชื่อ'
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className='input'
          placeholder='ตำแหน่ง'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className='input'
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          <option value='INCHARGE'>INCHARGE</option>
          <option value='MED'>MED</option>
        </select>
        <button
          className='btn btn-primary'
          onClick={onAdd}
        >
          เพิ่มพนักงาน
        </button>
      </div>
      <div className='grid md:grid-cols-2 gap-2'>
        {items.map((s: any) => (
          <div
            key={s.id}
            className='p-3 border rounded-xl flex items-center justify-between'
          >
            <div>
              <div className='font-medium'>
                {s.name} <span className='text-xs text-zinc-500'>({s.role})</span>
              </div>
              <div className='text-sm text-zinc-600'>{s.title}</div>
            </div>
            <div className='text-xs text-zinc-500'>{s.id.slice(0, 6)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
