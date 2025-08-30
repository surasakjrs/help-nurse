'use client';

type Shift = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export type CalendarGridProps = {
  daysInMonth: number;
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
  staffMap: Record<string, { id: string; name: string; role: string }>;
  staffArr: Array<{ id: string; name: string; role: string }>;
  chipClass: (s: Shift) => string;
};

function CalendarGrid(props: CalendarGridProps) {
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
      <div className='hidden md:grid lg:hidden gap-2 grid-cols-3'>
        <CalendarGridBody
          {...props}
          gridClass='grid-cols-3'
        />
      </div>

      {/* Desktop: 7 cols */}
      <div className='hidden lg:grid gap-2 grid-cols-5'>
        <CalendarGridBody
          {...props}
          gridClass='grid-cols-5'
        />
      </div>
    </>
  );
}

function CalendarGridBody({ gridClass, ...p }: CalendarGridProps & { gridClass: string }) {
  return (
    <>
      {Array.from({ length: p.daysInMonth }, (_, i) => i + 1).map((day) => (
        <DayCell
          key={day}
          day={day}
          {...p}
        />
      ))}
    </>
  );
}

function DayCell({
  day,
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
}: CalendarGridProps & { day: number }) {
  return (
    <div className='cell p-2 sm:p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='date text-sm sm:text-base'>{day}</div>
        <button
          className='btn xs'
          onClick={() => analyseDay(day)}
        >
          Analyse
        </button>
      </div>

      <div className='mt-4 sm:mt-6 space-y-2 text-xs sm:text-sm'>
        {SHIFTS.map((s, idx) => {
          const k = `${day}-${s}`;
          const ids = aIndex[k] || [];
          const vios = vIndex[k] || [];
          const isEditing = editingKey === k;
          const isLast = idx === SHIFTS.length - 1;

          return (
            <div
              key={s}
              className={`relative ${!isLast ? 'pb-2 border-b border-zinc-200' : ''}`}
            >
              {/* ใช้ flex + wrap คุมทั้งแถว */}
              <div className='flex items-center gap-2 flex-wrap md:flex-nowrap'>
                {/* pill คงที่ ไม่หด */}
                <div
                  className={`shrink-0 grid place-items-center w-6 h-6 sm:w-7 sm:h-7 rounded-full font-medium
                    ${s === 'MORNING' ? 'shift-m' : s === 'AFTERNOON' ? 'shift-a' : 'shift-n'}`}
                >
                  {s === 'MORNING' ? 'M' : s === 'AFTERNOON' ? 'A' : 'N'}
                </div>

                {/* รายชื่อ + badge (ยอมพับหลายบรรทัดได้) */}
                <div className='min-w-0 flex-1 flex flex-wrap items-center gap-1'>
                  {ids.length ? (
                    ids.map((id: string) => (
                      <span
                        key={id}
                        className={chipClass(s)}
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
                    className='btn xs ml-auto shrink-0'
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
