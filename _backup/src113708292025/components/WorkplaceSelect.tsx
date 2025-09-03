'use client';
import { useEffect, useState } from 'react';
import { listWorkplacesByOwner } from '@/services/firestore';
import { useAuth } from '@/context/AuthContext';

export default function WorkplaceSelect({ value, onChange }: { value?: string; onChange: (id: string) => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!user) return;
    listWorkplacesByOwner(user.uid).then(setItems);
  }, [user]);
  return (
    <select
      className='input'
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value=''>เลือกสถานที่ทำงาน</option>
      {items.map((it) => (
        <option
          key={it.id}
          value={it.id}
        >
          {it.name}
        </option>
      ))}
    </select>
  );
}
