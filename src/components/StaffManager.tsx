'use client';
import { useEffect, useState } from 'react';
import { addStaff, listStaff, removeStaff, updateStaff } from '@/services/staff.service';
import type { PersonColorKey, StaffRole } from '@/types/schema';
import { PERSON_COLORS, personPillClass, personPillLabel } from '@/utils/personColor';
import ColorDropdown from './ColorDropdown';

export default function StaffManager({ wid }: { wid: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('พยาบาล');
  const [role, setRole] = useState<StaffRole>('INCHARGE');
  const [color, setColor] = useState<PersonColorKey>('red');
  const [loading, setLoading] = useState(false);

  // inline edit states
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editRole, setEditRole] = useState<StaffRole>('INCHARGE');
  const [editColor, setEditColor] = useState<PersonColorKey>('red');
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
      await addStaff({ wid, name: name.trim(), title: title.trim() || undefined, role, active: true, color: color });
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
    setEditRole(it.role as StaffRole);
    setEditColor(it.color as PersonColorKey);
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
        role: editRole,
        color: editColor,
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
            name='name'
            autoComplete='on'
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
          />
          <input
            className='input'
            placeholder='ตำแหน่ง'
            value={title}
            name='title'
            onChange={(e) => setTitle(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
          />
          <select
            className='select'
            value={role}
            name='role'
            onChange={(e) => setRole(e.target.value as StaffRole)}
          >
            <option value='INCHARGE'>INCHARGE</option>
            <option value='MED'>MED</option>
          </select>

          <ColorDropdown
            value={color}
            onChange={setColor}
          />
          {/* <select
            className='select'
            value={color}
            onChange={(e) => setColor(e.target.value as PersonColorKey | '')}
          >
            <option value=''>— สีประจำตัว —</option>
            {(Object.keys(PERSON_COLORS) as PersonColorKey[]).map((k) => (
              <option
                key={k}
                value={k}
              >
                <span
                  className='w-4 h-4 inline-block mr-2 align-middle rounded-sm'
                  style={{ backgroundColor: PERSON_COLORS[k].cls.split(' ')[0].replace('bg-', '').replace('-100', '') }}
                />
                {PERSON_COLORS[k].label}
              </option>
            ))}
          </select> */}
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
              className={`card p-4 flex flex-row`}
            >
              <div className='flex items-center justify-between gap-3 grow flex-wrap'>
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
                    className='font-medium break-words w-full lg:w-auto'
                    onDoubleClick={() => startEdit(it)}
                  >
                    {it.name}
                  </div>
                )}

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

                {isEditing ? (
                  <div className='flex items-center gap-2'>
                    <ColorDropdown
                      value={editColor}
                      onChange={setEditColor}
                    />
                    <span className={`badge ${PERSON_COLORS[editColor]?.cls}`}>{PERSON_COLORS[editColor]?.label}</span>
                  </div>
                ) : (
                  <span className={`badge w-20 text-center ${personPillClass(it.color)}`}>
                    {personPillLabel(it.color)}
                  </span>
                )}

                {/* Role */}
                {isEditing ? (
                  <select
                    className='select'
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as StaffRole)}
                  >
                    <option value='INCHARGE'>INCHARGE</option>
                    <option value='MED'>MED</option>
                  </select>
                ) : (
                  <span className='badge'>{it.role}</span>
                )}
                {/* <span className={'badge ' + (it.active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600')}>
                  {it.active ? 'Active' : 'Inactive'}
                </span> */}

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
                      className='btn shadow-sm'
                      onClick={() => startEdit(it)}
                    >
                      แก้ไข
                    </button>
                    {/* <button
                      className='btn'
                      onClick={() => updateStaff(it.id, { active: !it.active }).then(refresh)}
                    >
                      {it.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    </button> */}
                    <button
                      className='btn shadow-sm'
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
