'use client';
import { useEffect, useMemo, useState } from 'react';
import { listStaff } from '@/services/staff.service';
import { getPlanner, savePlanner } from '@/services/planner.service';
import type { Planner, ShiftType } from '@/types/schema';
import { format } from 'date-fns';
import { useLoading } from '@/context/LoadingContext';

const SHIFTS: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];

function ymNow() {
  const d = new Date();
  return format(d, 'yyyy-MM');
}

export default function PlannerEditor({ wid }: { wid: string }) {
  const [ym, setYm] = useState(ymNow());
  const [staff, setStaff] = useState<any[]>([]);
  const [planner, setPlanner] = useState<Planner | null>(null);

  const { withLoading } = useLoading();

  useEffect(() => {
    listStaff(wid).then(setStaff);
  }, [wid]);
  useEffect(() => {
    getPlanner(wid, ym).then((p) => setPlanner(p));
  }, [wid, ym]);

  const demand = planner?.demand || { MORNING: 4, AFTERNOON: 4, NIGHT: 4 };
  const baseShifts = planner?.baseShifts || {};
  const minOT = planner?.minOT || {};
  const dayOff = planner?.dayOff || {};
  const preferences = planner?.preferences || {};
  const inchargeMin = planner?.inchargeMinPerShift ?? 1;
  const inchargeMax = planner?.inchargeMaxPerShift ?? 2;

  const staffMap = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const toggleDayOff = (sid: string, day: number) => {
    const arr = new Set(dayOff[sid] || []);
    if (arr.has(day)) arr.delete(day);
    else arr.add(day);
    const newDO = { ...dayOff, [sid]: Array.from(arr).sort((a, b) => a - b) };
    setPlanner({
      ...(planner || ({} as any)),
      wid,
      ym,
      demand,
      baseShifts,
      minOT,
      dayOff: newDO,
      preferences,
      inchargeMinPerShift: inchargeMin,
      inchargeMaxPerShift: inchargeMax,
    });
  };

  const setNum = (obj: Record<string, number>, sid: string, v: number) => {
    const neo = { ...obj, [sid]: v };
    setPlanner({
      ...(planner || ({} as any)),
      wid,
      ym,
      demand,
      baseShifts: obj === baseShifts ? neo : baseShifts,
      minOT: obj === minOT ? neo : minOT,
      dayOff,
      preferences,
      inchargeMinPerShift: inchargeMin,
      inchargeMaxPerShift: inchargeMax,
    });
  };

  const setPref = (sid: string, k: ShiftType, v: number) => {
    const curr = preferences[sid] || {};
    const neo = { ...preferences, [sid]: { ...curr, [k]: v } };
    setPlanner({
      ...(planner || ({} as any)),
      wid,
      ym,
      demand,
      baseShifts,
      minOT,
      dayOff,
      preferences: neo,
      inchargeMinPerShift: inchargeMin,
      inchargeMaxPerShift: inchargeMax,
    });
  };

  const setDemand = (k: ShiftType, v: number) => {
    const neo = { ...demand, [k]: v };
    setPlanner({
      ...(planner || ({} as any)),
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

  if (!planner) {
    // initialize default planner in memory (not saved yet)
    setPlanner({
      wid,
      ym,
      demand: { MORNING: 4, AFTERNOON: 4, NIGHT: 4 },
      baseShifts: {},
      minOT: {},
      dayOff: {},
      preferences: {},
      inchargeMinPerShift: 1,
      inchargeMaxPerShift: 2,
    });
    return null;
  }

  const onSavePlanner = async (p: Planner) => {
    await withLoading(async () => {
      await savePlanner(p);
      alert('บันทึกแผนเรียบร้อย');
    }, 'Saving planner');
  };

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2'>
        <h1 className='text-xl font-semibold'>แผนรายเดือน</h1>
        <input
          className='input w-40'
          type='month'
          value={ym}
          onChange={(e) => setYm(e.target.value)}
        />
        <button
          className='btn-primary'
          onClick={() => onSavePlanner(planner)}
        >
          บันทึกแผน
        </button>
      </div>

      <div className='card p-4 space-y-4'>
        <h2 className='font-medium'>กำหนดความต้องการคนต่อเวร</h2>
        <div className='grid md:grid-cols-5 gap-2'>
          {SHIFTS.map((s) => (
            <div
              key={s}
              className='flex items-center gap-2'
            >
              <div className='w-28'>{s}</div>
              <input
                type='number'
                min={0}
                className='input'
                value={demand[s]}
                onChange={(e) => setDemand(s as ShiftType, parseInt(e.target.value || '0'))}
              />
            </div>
          ))}
          <div className='flex items-center gap-2'>
            <div className='w-28'>INCHARGE min</div>
            <input
              type='number'
              min={0}
              className='input'
              value={inchargeMin}
              onChange={(e) => setPlanner({ ...planner, inchargeMinPerShift: parseInt(e.target.value || '0') })}
            />
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-28'>INCHARGE max</div>
            <input
              type='number'
              min={0}
              className='input'
              value={inchargeMax}
              onChange={(e) => setPlanner({ ...planner, inchargeMaxPerShift: parseInt(e.target.value || '0') })}
            />
          </div>
        </div>
      </div>

      <div className='card p-4 space-y-4'>
        <h2 className='font-medium'>พนักงานที่เลือกในเดือนนี้</h2>
        <table className='table'>
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
                  <div className='font-medium'>{s.name}</div>
                  <div className='text-xs text-zinc-500'>{s.role}</div>
                </td>
                <td>
                  <input
                    type='number'
                    min={0}
                    className='input w-24'
                    value={baseShifts[s.id] || 0}
                    onChange={(e) => setNum(baseShifts, s.id, parseInt(e.target.value || '0'))}
                  />
                </td>
                <td>
                  <input
                    type='number'
                    min={0}
                    className='input w-24'
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
                      className='input w-24'
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
    <div className='grid grid-cols-10 gap-1'>
      {days.map((d) => (
        <button
          key={d}
          className={'badge ' + (selected.has(d) ? 'bg-black text-white' : 'bg-white')}
          onClick={() => onToggle(d)}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
