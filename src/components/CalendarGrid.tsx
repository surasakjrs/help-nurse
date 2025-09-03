'use client';

import { PERSON_COLORS } from '@/utils/personColor';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useMemo, useRef, useState } from 'react';

type Shift = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export type CalendarGridProps = {
  daysInMonth: number;
  ym: string;
  SHIFTS: readonly Shift[];
  aIndex: Record<string, string[]>;
  vIndex: Record<string, string[] | undefined>;
  isAdmin: boolean;
  analyseDay: (day: number) => void;
  editingKey: string | null;
  openEditor: (day: number, shift: Shift) => void;
  cancelEditor: () => void;
  addSelect: string;
  setAddSelect: (v: string) => void;
  addToDraft: () => void;
  draftIds: string[];
  removeFromDraft: (id: string) => void;
  saveDraft: (day: number, shift: Shift) => void;
  planner: any;
  staffMap: Record<string, { id: string; name: string; role: string; color: string }>;
  staffArr: Array<{ id: string; name: string; role: string; color: string }>;
  chipClass: (s: Shift) => string;
  highlighted?: string;
};

function dayName(ym: string, day: number) {
  const [Y, M] = ym.split('-').map(Number);
  const date = new Date(Y, M - 1, day); // month ต้อง -1
  return format(date, 'EEEE', { locale: enUS }); // Monday, Tuesday, ...
}

function CalendarGrid(props: CalendarGridProps) {
  const { daysInMonth, ym } = props;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [gotoDay, setGotoDay] = useState<number | ''>('');

  // function scrollToDay(d: number) {
  //   console.log(d);
  //   if (!d) return;
  //   const el = document.getElementById(`day-${d}`);
  //   console.log(el);
  //   if (el) {
  //     el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  //     // ใส่คลาสไฮไลต์ชั่วคราว
  //     el.classList.add('ring-2', 'ring-violet-500', 'rounded-lg');
  //     setTimeout(() => el.classList.remove('ring-2', 'ring-violet-500', 'rounded-lg'), 1200);
  //   }
  // }

  // function scrollToToday() {
  //   const [Y, M] = ym.split('-').map(Number);
  //   const today = new Date();
  //   const isSameYM = today.getFullYear() === Y && today.getMonth() + 1 === M;
  //   const d = isSameYM ? today.getDate() : 1; // ถ้าไม่ใช่เดือนเดียวกัน ให้ไปวันที่ 1
  //   console.log(d);
  //   scrollToDay(d);
  //   setGotoDay(d);
  // }

  return (
    <>
      {/* Mobile: 1 col */}
      <div className='grid grid-cols-1 gap-2 md:hidden'>
        <CalendarGridBody
          {...props}
          gridClass='grid-cols-1'
        />
      </div>

      {/* Tablet: 3 cols */}
      <div className='hidden md:grid lg:hidden gap-2 grid-cols-1'>
        <CalendarGridBody
          {...props}
          gridClass='grid-cols-1'
        />
      </div>

      {/* Desktop: 7 cols */}
      <div className='hidden lg:grid gap-2 grid-cols-1'>
        <CalendarGridBody
          {...props}
          gridClass='grid-cols-1'
        />
      </div>

      {/* Sticky footer control */}
      {/* <div className='fixed bottom-4 left-1/2 -translate-x-1/2 z-40'>
        <div className='flex items-center gap-2 bg-white/90 backdrop-blur rounded-full border shadow-lg px-2 py-1'>
          <input
            type='number'
            min={1}
            max={daysInMonth}
            value={gotoDay}
            onChange={(e) => {
              const v = Number(e.target.value);
              setGotoDay(Number.isNaN(v) ? '' : Math.min(Math.max(v, 1), daysInMonth));
            }}
            className='input xs w-20 text-center'
            placeholder='Day'
          />
          <button
            className='btn-primary xs'
            onClick={() => typeof gotoDay === 'number' && scrollToDay(gotoDay)}
          >
            ไปวันที่
          </button>
          <button
            className='btn xs'
            onClick={scrollToToday}
          >
            วันนี้
          </button>
        </div>
      </div> */}
    </>
  );
}

function CalendarGridBody({ gridClass, ...p }: CalendarGridProps & { gridClass: string }) {
  const [highlight, setHighlight] = useState(false);

  function scrollToDay(d: number) {
    const el = document.getElementById(`day-${d}`);
    console.log(el);
    if (!el) {
      console.log(1);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // ไฮไลต์ชั่วคราว
    el.classList.add('ring-2', 'ring-violet-500', 'rounded-lg');
    setTimeout(() => el.classList.remove('ring-2', 'ring-violet-500', 'rounded-lg'), 1200);
  }

  const days = useMemo(() => Array.from({ length: p.daysInMonth }, (_, i) => i + 1), [p.daysInMonth]);

  const isToday = (d: number) => {
    const [Y, M] = p.ym.split('-').map(Number);
    const now = new Date();
    const sameYM = now.getFullYear() === Y && now.getMonth() + 1 === M;
    return sameYM && now.getDate() === d;
  };

  const highlighted = highlight ? 'ring-2 ring-violet-500 rounded-lg transition-all' : '';

  return (
    <>
      {Array.from({ length: p.daysInMonth }, (_, i) => i + 1).map((day) => (
        <DayCell
          key={day}
          day={day}
          {...p}
          highlighted={highlighted}
        />
      ))}

      {/* Sticky day buttons bar */}
      <div className='fixed inset-x-0 bottom-0 z-40'>
        <div className='mx-auto max-w-screen-2xl'>
          <div className='bg-white/90 backdrop-blur border-t shadow-lg'>
            <div className='flex items-center gap-1 overflow-x-auto px-2 py-2'>
              {days.map((d) => (
                <button
                  key={d}
                  onClick={() => scrollToDay(d)}
                  className={[
                    'min-w-9 h-9 px-2 rounded-md text-sm border',
                    isToday(d)
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-800 hover:bg-zinc-100 border-zinc-300',
                  ].join(' ')}
                  title={`Go to day ${d}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DayCell({
  day,
  ym,
  SHIFTS,
  aIndex,
  vIndex,
  isAdmin,
  analyseDay,
  editingKey,
  openEditor,
  cancelEditor,
  addSelect,
  setAddSelect,
  addToDraft,
  draftIds,
  removeFromDraft,
  saveDraft,
  planner,
  staffMap,
  staffArr,
  chipClass,
  highlighted,
}: CalendarGridProps & { day: number }) {
  return (
    <div
      id={`day-${day}`}
      className={`cell p-4 ${highlighted}`}
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='date text-sm sm:text-base'>
          {day} {dayName(ym, day)}
        </div>
        <button
          className='btn xs'
          onClick={() => analyseDay(day)}
        >
          Analyse
        </button>
      </div>

      <div className='md:flex mt-4 sm:mt-6 space-y-2 text-xs sm:text-sm'>
        {SHIFTS.map((s, idx) => {
          const k = `${day}-${s}`;
          const ids = aIndex[k] || [];
          const vios = vIndex[k] || [];
          const isEditing = editingKey === k;
          const isLast = idx === SHIFTS.length - 1;

          return (
            <div
              key={s}
              className={`relative ${!isLast ? 'pb-2 border-b md:border-0 border-zinc-200' : ''}`}
            >
              {/* ใช้ flex + wrap คุมทั้งแถว */}
              <div className='flex flex-col items-center gap-2 flex-wrap md:flex-nowrap'>
                {/* pill คงที่ ไม่หด */}
                <div
                  className={`shrink-0 grid place-items-center w-full h-7 rounded-full font-medium
                      ${s === 'MORNING' ? 'shift-m' : s === 'AFTERNOON' ? 'shift-a' : 'shift-n'}`}
                >
                  {s === 'MORNING' ? 'MORNING' : s === 'AFTERNOON' ? 'AFTERNOON' : 'NIGHT'}
                </div>

                {/* รายชื่อ + badge (ยอมพับหลายบรรทัดได้) */}
                <div className='min-w-0 flex-1 flex flex-wrap items-center gap-1'>
                  {ids.length ? (
                    ids.map((id: string) => (
                      <span
                        key={id}
                        // className={chipClass(s)}
                        className={`w-full justify-center ${
                          PERSON_COLORS[staffMap[id]?.color as keyof typeof PERSON_COLORS].cls ||
                          'bg-gray-100 text-gray-800'
                        } inline-flex items-center text-[16px] sm:text-[11px] px-1.5 py-0.5 rounded border border-zinc-200`}
                      >
                        {staffMap[id]?.name ?? id}
                      </span>
                    ))
                  ) : (
                    <span className='text-zinc-400'>-</span>
                  )}

                  {vios?.includes('NO_INCHARGE') && (
                    <span className='inline-flex items-center ml-1 text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200'>
                      ไม่มี INCHARGE
                    </span>
                  )}
                  {vios?.includes('UNDER_STAFFED') && (
                    <span className='inline-flex items-center ml-1 text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200'>
                      คนไม่ครบ
                    </span>
                  )}
                </div>

                {/* ปุ่มแก้ไข ชิดขวา และไม่หด */}
                {isAdmin && (
                  <button
                    className='btn xs mx-auto shrink-0'
                    onClick={() => (isEditing ? cancelEditor() : openEditor(day, s))}
                  >
                    {isEditing ? 'ยกเลิก' : 'แก้ไข'}
                  </button>
                )}
              </div>

              {/* แพเนลแก้ไข (เดสก์ท็อปลอย, มือถืออยู่ใน flow) */}
              {isEditing && (
                <div className='absolute md:left-0 md:top-full md:mt-2 z-30 md:w-[min(420px,calc(100vw-3rem))]'>
                  <div className='card p-3 space-y-2 shadow-lg ring-1 ring-zinc-200 w-full'>
                    <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
                      <select
                        className='select min-w-44 w-full sm:w-auto'
                        value={addSelect}
                        onChange={(e) => setAddSelect(e.target.value)}
                      >
                        <option value=''>-- เพิ่มพนักงาน --</option>
                        {staffArr.map((u) => (
                          <option
                            key={u.id}
                            value={u.id}
                          >
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
                      <button
                        className='btn w-full sm:w-auto'
                        onClick={addToDraft}
                      >
                        เพิ่ม
                      </button>
                      <div className='text-xs text-zinc-600 sm:ml-auto'>
                        ต้องการคน: {planner?.demand?.[s] ?? 0} | เลือกแล้ว: {draftIds.length}
                      </div>
                    </div>

                    <div className='flex flex-wrap gap-1'>
                      {draftIds.length ? (
                        draftIds.map((id) => (
                          <span
                            key={`draft-${id}`}
                            className='chip'
                          >
                            {staffMap[id]?.name ?? id}
                            <button
                              className='ml-1 text-xs'
                              onClick={() => removeFromDraft(id)}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className='text-zinc-400'>ยังไม่มีคน</span>
                      )}
                    </div>

                    <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end'>
                      <button
                        className='btn w-full sm:w-auto'
                        onClick={cancelEditor}
                      >
                        ยกเลิก
                      </button>
                      <button
                        className='btn-primary w-full sm:w-auto'
                        onClick={() => saveDraft(day, s)}
                      >
                        บันทึก
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CalendarGrid;
