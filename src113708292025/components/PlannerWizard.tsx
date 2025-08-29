'use client';
import { useEffect, useMemo, useState } from 'react';
import MonthPicker from './MonthPicker';
import WorkplaceSelect from './WorkplaceSelect';
import { listStaff, upsertPlan } from '@/services/firestore';
import type { ShiftType } from '@/types/schema';
import { useAuth } from '@/context/AuthContext';

const SHIFTS: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];

export default function PlannerWizard() {
  const { user } = useAuth();
  const [wid, setWid] = useState('');
  const [yyyymm, setYyyymm] = useState(() => new Date().toISOString().slice(0, 7).replace('-', ''));
  const [staff, setStaff] = useState<any[]>([]);

  // Step 2
  const [selected, setSelected] = useState<string[]>([]);

  // Step 3
  const [dayOff, setDayOff] = useState<Record<string, string>>({});

  // Step 4
  const [mainQuota, setMainQuota] = useState<Record<string, number>>({});
  const [demand, setDemand] = useState<Record<ShiftType, number>>({ MORNING: 3, AFTERNOON: 3, NIGHT: 2 });

  // ✅ Step 5: OT ขั้นต่ำ
  const [otMin, setOtMin] = useState<Record<string, number>>({});

  // Step 6 preview
  const preview = useMemo(() => {
    const sumMain = Object.values(mainQuota).reduce((a, b) => a + b, 0);
    const sumOTMin = Object.values(otMin).reduce((a, b) => a + b, 0);
    return { sumMain, sumOTMin, staffCount: selected.length };
  }, [mainQuota, otMin, selected]);

  useEffect(() => {
    if (!wid) return;
    listStaff(wid).then(setStaff);
  }, [wid]);

  return (
    <div className='space-y-6'>
      {/* Step 1 */}
      <div className='card p-4 space-y-4'>
        <h2 className='text-lg font-semibold'>Step 1 – เลือกเดือน & สถานที่</h2>
        <div className='grid md:grid-cols-3 gap-3'>
          <div>
            <div className='label mb-1'>สถานที่</div>
            <WorkplaceSelect
              value={wid}
              onChange={setWid}
            />
          </div>
          <div>
            <div className='label mb-1'>เดือน</div>
            <MonthPicker
              value={yyyymm}
              onChange={setYyyymm}
            />
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className='card p-4 space-y-3'>
        <h2 className='text-lg font-semibold'>Step 2 – เลือกพนักงาน (เดือนนี้)</h2>
        <div className='grid md:grid-cols-3 gap-2'>
          {staff.map((s) => (
            <label
              key={s.id}
              className='flex items-center gap-2 p-2 border rounded-xl'
            >
              <input
                type='checkbox'
                checked={selected.includes(s.id)}
                onChange={(e) => {
                  setSelected((v) => (e.target.checked ? [...v, s.id] : v.filter((x) => x !== s.id)));
                  setMainQuota((v) => ({ ...v, [s.id]: v[s.id] ?? 22 }));
                  setOtMin((v) => ({ ...v, [s.id]: v[s.id] ?? 0 }));
                  setDayOff((v) => ({ ...v, [s.id]: v[s.id] ?? '' }));
                }}
              />
              <span className='text-sm'>
                {s.name} <span className='text-xs text-zinc-500'>({s.role})</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Step 3 */}
      <div className='card p-4 space-y-3'>
        <h2 className='text-lg font-semibold'>Step 3 – กรอกวันหยุด (เช่น 1,3,5)</h2>
        <div className='grid md:grid-cols-3 gap-2'>
          {selected.map((id) => (
            <div
              key={id}
              className='flex items-center gap-2'
            >
              <span className='w-36 text-sm truncate'>{staff.find((s) => s.id === id)?.name}</span>
              <input
                className='input flex-1'
                placeholder='1,3,5'
                value={dayOff[id] || ''}
                onChange={(e) => setDayOff((v) => ({ ...v, [id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Step 4 */}
      <div className='card p-4 space-y-3'>
        <h2 className='text-lg font-semibold'>Step 4 – เวรหลัก/ดีมานด์</h2>
        <div className='grid md:grid-cols-3 gap-2'>
          {selected.map((id) => (
            <div
              key={id}
              className='flex items-center gap-2'
            >
              <span className='w-36 text-sm truncate'>{staff.find((s) => s.id === id)?.name}</span>
              <input
                type='number'
                className='input w-28'
                value={mainQuota[id] || 0}
                onChange={(e) => setMainQuota((v) => ({ ...v, [id]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
        <div className='grid md:grid-cols-3 gap-2 pt-2'>
          {(['MORNING', 'AFTERNOON', 'NIGHT'] as const).map((sh) => (
            <div
              key={sh}
              className='flex items-center gap-2'
            >
              <span className='w-36 text-sm'>ความต้องการ {sh}</span>
              <input
                type='number'
                className='input w-28'
                value={demand[sh]}
                onChange={(e) => setDemand((v) => ({ ...v, [sh]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ✅ Step 5: OT ขั้นต่ำ */}
      <div className='card p-4 space-y-3'>
        <h2 className='text-lg font-semibold'>Step 5 – OT ขั้นต่ำต่อคน</h2>
        <div className='grid md:grid-cols-3 gap-2'>
          {selected.map((id) => (
            <div
              key={id}
              className='flex items-center gap-2'
            >
              <span className='w-36 text-sm truncate'>{staff.find((s) => s.id === id)?.name}</span>
              <input
                type='number'
                min={0}
                className='input w-28'
                value={otMin[id] || 0}
                onChange={(e) => setOtMin((v) => ({ ...v, [id]: Math.max(0, Number(e.target.value)) }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Step 6 */}
      <div className='card p-4 space-y-2'>
        <h2 className='text-lg font-semibold'>Step 6 – สรุป</h2>
        <div className='text-sm text-zinc-700'>
          คนที่เลือก: {preview.staffCount} คน · เวรหลักรวม: {preview.sumMain} · OT ขั้นต่ำรวม: {preview.sumOTMin}
        </div>
      </div>

      {/* Step 7 */}
      <div className='card p-4 space-y-3'>
        <h2 className='text-lg font-semibold'>Step 7 – บันทึกข้อมูล</h2>
        <div className='grid md:grid-cols-3 gap-2'>
          <div className='flex items-center gap-2'>
            <span className='label'>INCHARGE min</span>
            <input
              className='input w-20'
              defaultValue={1}
              id='inch-min'
            />
          </div>
          <div className='flex items-center gap-2'>
            <span className='label'>INCHARGE max</span>
            <input
              className='input w-20'
              defaultValue={2}
              id='inch-max'
            />
          </div>
        </div>
        <div className='flex gap-2'>
          <button
            className='btn btn-primary'
            onClick={async () => {
              if (!wid) return alert('กรุณาเลือกสถานที่');
              await upsertPlan({
                wid,
                yyyymm,
                staffSelected: selected,
                mainQuota,
                /** ✅ บันทึกเป็น OT ขั้นต่ำ */
                otMin,
                dayOff: Object.fromEntries(
                  Object.entries(dayOff).map(([k, v]) => [
                    k,
                    v
                      .split(',')
                      .map((s) => Number(s.trim()))
                      .filter((n) => !Number.isNaN(n)),
                  ])
                ),
                demandPerShift: demand,
                inchargeMin: Number((document.getElementById('inch-min') as HTMLInputElement)?.value || 1),
                inchargeMax: Number((document.getElementById('inch-max') as HTMLInputElement)?.value || 2),
                createdBy: user?.uid || 'anonymous',
              });
              alert('บันทึกแผนสำเร็จ!');
            }}
          >
            บันทึกแผน
          </button>
        </div>
      </div>
    </div>
  );
}
