'use client';
import { useEffect, useState } from 'react';
import { addStaff, listStaff, removeStaff, updateStaff } from '@/services/staff.service';
import type { StaffRole } from '@/types/schema';

export default function StaffManager({ wid }: { wid: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<StaffRole>('MED');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wid) return;
    let alive = true;
    (async () => {
      const data = await listStaff(wid);
      if (alive) setItems(data);
    })();
    return () => {
      alive = false;
    };
  }, [wid]);

  const refresh = async () => {
    const data = await listStaff(wid);
    setItems(data);
  };

  const onAdd = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await addStaff({ wid, name: name.trim(), title: title.trim() || undefined, role, active: true });
      setName('');
      setTitle('');
      setRole('MED');
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='card p-4'>
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
            className='select'
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
          >
            <option value='INCHARGE'>INCHARGE</option>
            <option value='MED'>MED</option>
          </select>
          <button
            className='btn-primary'
            onClick={onAdd}
            disabled={loading || !name.trim()}
          >
            {loading ? 'กำลังเพิ่ม...' : 'เพิ่มพนักงาน'}
          </button>
        </div>
      </div>
      <div className='card p-4'>
        <table className='table'>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>ตำแหน่ง</th>
              <th>บทบาท</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.name}</td>
                <td>{it.title || '-'}</td>
                <td>
                  <span className='badge'>{it.role}</span>
                </td>
                <td>{it.active ? 'Active' : 'Inactive'}</td>
                <td className='text-right'>
                  <button
                    className='btn mr-2'
                    onClick={() => updateStaff(it.id, { active: !it.active }).then(refresh)}
                  >
                    {it.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                  <button
                    className='btn'
                    onClick={() => removeStaff(it.id).then(refresh)}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td
                  colSpan={5}
                  className='text-center text-zinc-500'
                >
                  ยังไม่มีพนักงาน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
