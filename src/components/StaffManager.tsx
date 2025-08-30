'use client';
import { useEffect, useState } from 'react';
import { addStaff, listStaff, removeStaff, updateStaff } from '@/services/staff.service';
import type { StaffRole } from '@/types/schema';

export default function StaffManager({ wid }: { wid: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<StaffRole>('INCHARGE');
  const [loading, setLoading] = useState(false);

  // inline edit states
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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
      // setName(''); setTitle(''); setRole('INCHARGE'); // ถ้าต้องการเคลียร์ฟอร์ม
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (it: any) => {
    setEditId(it.id);
    setEditName(it.name ?? '');
    setEditTitle(it.title ?? '');
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName('');
    setEditTitle('');
    setSavingEdit(false);
  };

  const commitEdit = async () => {
    if (!editId) return;
    if (!editName.trim()) return; // กันชื่อว่าง
    setSavingEdit(true);
    try {
      await updateStaff(editId, {
        name: editName.trim(),
        title: editTitle.trim() || undefined,
      });
      await refresh();
      cancelEdit();
    } finally {
      setSavingEdit(false);
    }
  };

  const onEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') cancelEdit();
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
            onFocus={(e) => e.currentTarget.select()}
          />
          <input
            className='input'
            placeholder='ตำแหน่ง'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
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

      <div className='space-y-3'>
        {items.map((it) => {
          const isEditing = editId === it.id;
          return (
            <div
              key={it.id}
              className='card p-4'
            >
              {/* Header: ชื่อ/ตำแหน่ง + badges */}
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  {/* ชื่อ */}
                  {isEditing ? (
                    <input
                      className='input w-full'
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={onEditKeyDown}
                      autoFocus
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder='กรอกชื่อ'
                    />
                  ) : (
                    <div
                      className='font-medium break-words'
                      onDoubleClick={() => startEdit(it)}
                    >
                      {it.name}
                    </div>
                  )}

                  {/* ตำแหน่ง */}
                  <div className='mt-1'>
                    {isEditing ? (
                      <input
                        className='input w-full'
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={onEditKeyDown}
                        onFocus={(e) => e.currentTarget.select()}
                        placeholder='ตำแหน่ง'
                      />
                    ) : (
                      <span
                        className='text-sm text-zinc-500 break-words'
                        onDoubleClick={() => startEdit(it)}
                      >
                        {it.title || '-'}
                      </span>
                    )}
                  </div>
                </div>

                {/* บทบาท + สถานะ */}
                <div className='flex flex-col items-end gap-2 shrink-0'>
                  <span className='badge'>{it.role}</span>
                  <span
                    className={'badge ' + (it.active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600')}
                  >
                    {it.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className='mt-3 flex flex-wrap gap-2 justify-end'>
                {isEditing ? (
                  <>
                    <button
                      className='btn-primary'
                      onClick={commitEdit}
                      disabled={savingEdit || !editName.trim()}
                    >
                      {savingEdit ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                    <button
                      className='btn'
                      onClick={cancelEdit}
                      disabled={savingEdit}
                    >
                      ยกเลิก
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className='btn'
                      onClick={() => startEdit(it)}
                    >
                      แก้ไข
                    </button>
                    <button
                      className='btn'
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
                  </>
                )}
              </div>
            </div>
          );
        })}

        {!items.length && <div className='card p-4 text-center text-zinc-500'>ยังไม่มีพนักงาน</div>}
      </div>
    </div>
  );
}
