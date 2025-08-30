'use client';
import { useEffect, useMemo, useState } from 'react';
import { listStaff } from '@/services/staff.service';
import { getPlanner, savePlanner } from '@/services/planner.service';
import type { Planner, ShiftType } from '@/types/schema';
import { format } from 'date-fns';
import { useLoading } from '@/context/LoadingContext';

const SHIFTS: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];
const DEFAULT_BASE = 22; // เวรหลักต่อเดือนเริ่มต้น
const DEFAULT_MIN_OT = 0; // OT ขั้นต่ำเริ่มต้น

function ymNow() {
  const d = new Date();
  return format(d, 'yyyy-MM');
}

function withDefaults(p: Planner, staffList: any[]): Planner {
  const base = { ...p.baseShifts };
  const ot = { ...p.minOT };

  for (const s of staffList) {
    if (base[s.id] == null) base[s.id] = DEFAULT_BASE;
    if (ot[s.id] == null) ot[s.id] = DEFAULT_MIN_OT;
  }
  return { ...p, baseShifts: base, minOT: ot };
}

export default function PlannerEditor({ wid }: { wid: string }) {
  const [ym, setYm] = useState(ymNow());
  const [staff, setStaff] = useState<any[]>([]);
  const [planner, setPlanner] = useState<Planner | null>(null);

  const { withLoading } = useLoading();

  // Fetch staff
  useEffect(() => {
    listStaff(wid).then(setStaff);
  }, [wid]);

  // Fetch planner
  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await getPlanner(wid, ym);
      if (!alive) return;
      // if (p) setPlanner(p);
      if (p) setPlanner(withDefaults(p, staff));
      // setPlanner({
      //   wid,
      //   ym,
      //   demand: { MORNING: 4, AFTERNOON: 4, NIGHT: 4 },
      //   baseShifts: {},
      //   minOT: {},
      //   dayOff: {},
      //   preferences: {},
      //   inchargeMinPerShift: 1,
      //   inchargeMaxPerShift: 2,
      // });
      else {
        const fresh: Planner = {
          wid,
          ym,
          demand: { MORNING: 4, AFTERNOON: 4, NIGHT: 4 },
          baseShifts: {},
          minOT: {},
          dayOff: {},
          preferences: {},
          inchargeMinPerShift: 1,
          inchargeMaxPerShift: 2,
        };
        setPlanner(withDefaults(fresh, staff));
      }
    })();
    return () => {
      alive = false;
    };
  }, [wid, ym, staff]);

  const demand = planner?.demand || { MORNING: 4, AFTERNOON: 4, NIGHT: 4 };
  const baseShifts = planner?.baseShifts || {};
  const minOT = planner?.minOT || {};
  const dayOff = planner?.dayOff || {};
  const preferences = planner?.preferences || {};
  const inchargeMin = planner?.inchargeMinPerShift ?? 1;
  const inchargeMax = planner?.inchargeMaxPerShift ?? 2;

  const staffMap = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const mergePlanner = (patch: Partial<Planner>) => setPlanner((p) => ({ ...(p as Planner), ...patch }));

  const toggleDayOff = (sid: string, day: number) => {
    const arr = new Set(dayOff[sid] || []);
    if (arr.has(day)) arr.delete(day);
    else arr.add(day);
    const newDO = { ...dayOff, [sid]: Array.from(arr).sort((a, b) => a - b) };
    mergePlanner({
      wid,
      ym,
      dayOff: newDO,
      demand,
      baseShifts,
      minOT,
      preferences,
      inchargeMinPerShift: inchargeMin,
      inchargeMaxPerShift: inchargeMax,
    });
  };

  const setNum = (obj: Record<string, number>, sid: string, v: number) => {
    const neo = { ...obj, [sid]: v };
    mergePlanner({
      wid,
      ym,
      baseShifts: obj === baseShifts ? neo : baseShifts,
      minOT: obj === minOT ? neo : minOT,
      dayOff,
      preferences,
      demand,
      inchargeMinPerShift: inchargeMin,
      inchargeMaxPerShift: inchargeMax,
    });
  };

  const setPref = (sid: string, k: ShiftType, v: number) => {
    const curr = preferences[sid] || {};
    const neo = { ...preferences, [sid]: { ...curr, [k]: v } };
    mergePlanner({
      wid,
      ym,
      preferences: neo,
      baseShifts,
      minOT,
      dayOff,
      demand,
      inchargeMinPerShift: inchargeMin,
      inchargeMaxPerShift: inchargeMax,
    });
  };

  const setDemand = (k: ShiftType, v: number) => {
    const neo = { ...demand, [k]: v };
    mergePlanner({
      wid,
      ym,
      demand: neo,
      baseShifts,
      minOT,
      dayOff,
      preferences,
      inchargeMinPerShift: inchargeMin,
      inchargeMaxPerShift: inchargeMax,
    });
  };

  const daysInMonth = useMemo(() => {
    const [Y, M] = ym.split('-').map(Number);
    return new Date(Y, M, 0).getDate();
  }, [ym]);

  const onSavePlanner = async (p: Planner) => {
    await withLoading(async () => {
      await savePlanner(p);
      alert('บันทึกแผนเรียบร้อย');
    }, 'Saving planner');
  };

  if (!planner) return null;

  return (
    <div className='space-y-6'>
      {/* Toolbar */}
      <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
        <h1 className='text-lg sm:text-xl font-semibold'>แผนรายเดือน</h1>
        <div className='flex flex-col xs:flex-row gap-2 xs:items-center'>
          <input
            className='input w-full xs:w-44 sm:w-40'
            type='month'
            value={ym}
            onChange={(e) => setYm(e.target.value)}
          />
          <button
            className='btn-primary w-full xs:w-auto'
            onClick={() => onSavePlanner(planner)}
          >
            บันทึกแผน
          </button>
        </div>
      </div>

      {/* Demand section */}
      <div className='card p-3 sm:p-4 space-y-3'>
        <h2 className='font-medium'>กำหนดความต้องการคนต่อเวร</h2>
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2'>
          {SHIFTS.map((s) => (
            <div
              key={s}
              className='flex items-center gap-2'
            >
              <div className='w-24 sm:w-28 text-sm sm:text-base'>{s}</div>
              <input
                type='number'
                min={0}
                className='input w-full max-w-[120px]'
                value={demand[s]}
                onChange={(e) => setDemand(s as ShiftType, parseInt(e.target.value || '0'))}
              />
            </div>
          ))}
          <div className='flex items-center gap-2'>
            <div className='w-24 sm:w-28 text-sm sm:text-base'>INCHARGE min</div>
            <input
              type='number'
              min={0}
              className='input w-full max-w-[120px]'
              value={inchargeMin}
              onChange={(e) => mergePlanner({ ...planner, inchargeMinPerShift: parseInt(e.target.value || '0') })}
            />
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-24 sm:w-28 text-sm sm:text-base'>INCHARGE max</div>
            <input
              type='number'
              min={0}
              className='input w-full max-w-[120px]'
              value={inchargeMax}
              onChange={(e) => mergePlanner({ ...planner, inchargeMaxPerShift: parseInt(e.target.value || '0') })}
            />
          </div>
        </div>
      </div>

      {/* Staff table: horizontal scroll on mobile */}
      <div className='space-y-3'>
        {staff.map((s) => (
          <div
            key={s.id}
            className='card p-3 sm:p-4'
          >
            {/* Header */}
            <div className='flex items-center justify-between gap-3'>
              <div>
                <div className='font-medium'>{s.name}</div>
                <div className='text-xs text-zinc-500'>{s.role}</div>
              </div>
            </div>

            {/* Inputs */}
            <div className='mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3'>
              <label className='flex flex-col gap-1'>
                <span className='text-xs text-zinc-500'>เวรหลัก (ต่อเดือน)</span>
                <input
                  type='number'
                  min={0}
                  className='input w-full'
                  value={baseShifts[s.id] || 0}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNum(baseShifts, s.id, parseInt(e.target.value || '0'))}
                />
              </label>

              <label className='flex flex-col gap-1'>
                <span className='text-xs text-zinc-500'>OT ขั้นต่ำ (ต่อเดือน)</span>
                <input
                  type='number'
                  min={0}
                  className='input w-full'
                  value={minOT[s.id] || 0}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNum(minOT, s.id, parseInt(e.target.value || '0'))}
                />
              </label>

              {(['MORNING', 'AFTERNOON', 'NIGHT'] as ShiftType[]).map((k) => (
                <label
                  key={k}
                  className='flex flex-col gap-1'
                >
                  <span className='text-xs text-zinc-500'>
                    {k === 'MORNING' ? 'ชอบ M' : k === 'AFTERNOON' ? 'ชอบ A' : 'ชอบ N'}
                  </span>
                  <select
                    className='select input w-full'
                    value={preferences[s.id]?.[k] ?? 0.5}
                    onChange={(e) => setPref(s.id, k, parseFloat(e.target.value || '0'))}
                  >
                    <option value={0}>ไม่ชอบ</option>
                    <option value={0.5}>ปกติ</option>
                    <option value={1}>ชอบ</option>
                  </select>
                </label>
              ))}

              {/* {(['MORNING', 'AFTERNOON', 'NIGHT'] as ShiftType[]).map((k) => (
                <label
                  key={k}
                  className='flex flex-col gap-1'
                >
                  <span className='text-xs text-zinc-500'>
                    {k === 'MORNING' ? 'ชอบ M' : k === 'AFTERNOON' ? 'ชอบ A' : 'ชอบ N'}
                  </span>
                  <input
                    type='number'
                    min={0}
                    max={1}
                    step={0.1}
                    className='input w-full'
                    value={preferences[s.id]?.[k] ?? 0.5}
                    onChange={(e) => setPref(s.id, k, parseFloat(e.target.value || '0'))}
                  />
                </label>
              ))} */}
            </div>

            {/* Days Picker */}
            <div className='mt-3'>
              <div className='text-xs text-zinc-500 mb-1'>วันหยุด (คลิกเลือกวัน)</div>
              <div className='overflow-x-auto'>
                <DaysPicker
                  days={Array.from({ length: daysInMonth }, (_, i) => i + 1)}
                  selected={new Set(dayOff[s.id] || [])}
                  onToggle={(d) => toggleDayOff(s.id, d)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className='flex flex-col xs:flex-row gap-2 xs:items-center'>
        <button
          className='btn-primary w-full xs:w-auto'
          onClick={() => onSavePlanner(planner)}
        >
          บันทึกแผน
        </button>
      </div>
      {/* <div className='card p-3 sm:p-4 space-y-3'>
        <h2 className='font-medium'>พนักงานที่เลือกในเดือนนี้</h2>
        <div className='overflow-x-auto -mx-3 sm:mx-0'>
          <table className='table min-w-[840px] sm:min-w-[1000px]'>
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>Base</th>
                <th>OT ขั้นต่ำ</th>
                <th>ชอบ M</th>
                <th>ชอบ A</th>
                <th>ชอบ N</th>
                <th>วันหยุด (คลิกเลือกวัน)</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className='font-medium whitespace-nowrap'>{s.name}</div>
                    <div className='text-xs text-zinc-500'>{s.role}</div>
                  </td>
                  <td>
                    <input
                      type='number'
                      min={0}
                      className='input w-20 sm:w-24'
                      value={baseShifts[s.id] || 0}
                      onChange={(e) => setNum(baseShifts, s.id, parseInt(e.target.value || '0'))}
                    />
                  </td>
                  <td>
                    <input
                      type='number'
                      min={0}
                      className='input w-20 sm:w-24'
                      value={minOT[s.id] || 0}
                      onChange={(e) => setNum(minOT, s.id, parseInt(e.target.value || '0'))}
                    />
                  </td>
                  {(['MORNING', 'AFTERNOON', 'NIGHT'] as ShiftType[]).map((k) => (
                    <td key={k}>
                      <input
                        type='number'
                        min={0}
                        max={1}
                        step='0.1'
                        className='input w-20 sm:w-24'
                        value={preferences[s.id]?.[k] ?? 0.5}
                        onChange={(e) => setPref(s.id, k, parseFloat(e.target.value || '0'))}
                      />
                    </td>
                  ))}
                  <td>
                    <DaysPicker
                      days={Array.from({ length: daysInMonth }, (_, i) => i + 1)}
                      selected={new Set(dayOff[s.id] || [])}
                      onToggle={(d) => toggleDayOff(s.id, d)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div> */}
    </div>
  );
}

function DaysPicker({
  days,
  selected,
  onToggle,
}: {
  days: number[];
  selected: Set<number>;
  onToggle: (d: number) => void;
}) {
  return (
    <div className='grid grid-cols-7 xs:grid-cols-8 sm:grid-cols-10 gap-1'>
      {days.map((d) => (
        <button
          key={d}
          className={'badge text-xs sm:text-sm px-2 py-1 ' + (selected.has(d) ? 'bg-black text-white' : 'bg-white')}
          onClick={() => onToggle(d)}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
