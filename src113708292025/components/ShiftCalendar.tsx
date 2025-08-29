'use client';
import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { addAssignment, clearAssignments, getPlan, listAssignments, listStaff, planId } from '@/services/firestore';
import { eachDayOfInterval, endOfMonth, format, startOfMonth, isWeekend } from 'date-fns';
import type { ShiftType } from '@/types/schema';
import { generateAssignments } from '@/lib/scheduler';
import { exportCsv, exportPdf } from '@/lib/export';

const SHIFTS: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];
type Item = { id: string; label: string; role: 'INCHARGE' | 'MED' };

export default function ShiftCalendar({ wid, yyyymm }: { wid: string; yyyymm: string }) {
  const [staff, setStaff] = useState<Item[]>([]);
  const [slots, setSlots] = useState<Record<string, Item[]>>({});
  const [meta, setMeta] = useState<any>(null);

  const year = Number(yyyymm.slice(0, 4));
  const month = Number(yyyymm.slice(4)) - 1;
  const days = eachDayOfInterval({
    start: startOfMonth(new Date(year, month, 1)),
    end: endOfMonth(new Date(year, month, 1)),
  });

  const keyOf = (d: string, s: ShiftType) => `${d}|${s}`;

  useEffect(() => {
    async function init() {
      const [st, plan] = await Promise.all([listStaff(wid), getPlan(wid, yyyymm)]);
      setMeta(plan);
      setStaff(st.map((s: any) => ({ id: s.id, label: `${s.name} (${s.role})`, role: s.role })));
      if (!plan) return;
      const pid = planId(wid, yyyymm);
      const asg = await listAssignments(pid);
      const obj: Record<string, Item[]> = {};
      for (const a of asg) {
        const k = keyOf(a.date, a.shift);
        obj[k] = obj[k] || [];
        const person = st.find((x: any) => x.id === a.staffId);
        if (person) obj[k].push({ id: person.id, label: `${person.name} (${person.role})`, role: person.role });
      }
      setSlots(obj);
    }
    init();
  }, [wid, yyyymm]);

  async function runAutoAssign(filterRole?: 'INCHARGE' | 'MED') {
    if (!meta) {
      alert('กรุณาบันทึกแผนในวิซาร์ดก่อน');
      return;
    }

    let stLite = staff
      .filter((s) => meta.staffSelected.includes(s.id))
      .map((s) => ({ id: s.id, name: s.label.split(' (')[0], role: s.role }));
    if (filterRole) {
      stLite = stLite.filter((s) => s.role === filterRole);
    }

    const { assignments } = generateAssignments({ meta, staff: stLite });
    const pid = planId(wid, yyyymm);
    await clearAssignments(pid);
    for (const a of assignments) {
      await addAssignment(pid, a);
    }
    const obj: Record<string, Item[]> = {};
    for (const a of assignments) {
      const k = keyOf(a.date, a.shift);
      obj[k] = obj[k] || [];
      const person = staff.find((x) => x.id === a.staffId);
      if (person) obj[k].push(person);
    }
    setSlots(obj);
    alert(`จัดเวรอัตโนมัติสำเร็จ (${filterRole ?? 'ALL'})!`);
  }

  function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    setSlots((prev) => {
      const next = { ...prev };
      const srcArr = Array.from(next[source.droppableId] || []);
      const [moved] = srcArr.splice(source.index, 1);
      next[source.droppableId] = srcArr;
      const dstArr = Array.from(next[destination.droppableId] || []);
      dstArr.splice(destination.index, 0, moved || staff.find((s) => s.id === draggableId)!);
      next[destination.droppableId] = dstArr;
      return next;
    });
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-2'>
        {/* ✅ ปุ่ม auto assign 3 แบบ */}
        <button
          className='btn'
          onClick={() => runAutoAssign()}
        >
          Auto Assign (All)
        </button>
        <button
          className='btn'
          onClick={() => runAutoAssign('INCHARGE')}
        >
          Auto Assign INCHARGE
        </button>
        <button
          className='btn'
          onClick={() => runAutoAssign('MED')}
        >
          Auto Assign MED
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className='grid md:grid-cols-3 gap-4'>
          {days.map((d) => {
            const iso = format(d, 'yyyy-MM-dd');
            return (
              <div
                key={iso}
                className='card p-3'
              >
                <div className='flex items-center justify-between mb-2'>
                  <div className='font-medium'>{iso}</div>
                  {isWeekend(d) && <span className='text-xs px-2 py-1 rounded-full bg-sky-100'>Weekend</span>}
                </div>
                {SHIFTS.map((sh) => {
                  const id = keyOf(iso, sh);
                  return (
                    <div
                      key={id}
                      className='mb-3'
                    >
                      <div className='text-xs mb-1 text-zinc-600'>{sh}</div>
                      <Droppable
                        droppableId={id}
                        direction='vertical'
                      >
                        {(prov) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.droppableProps}
                            className='min-h-10 p-2 rounded-xl border border-dashed'
                          >
                            {(slots[id] || []).map((p, idx) => (
                              <Draggable
                                key={`${id}-${p.id}-${idx}`}
                                draggableId={`${id}-${p.id}-${idx}`}
                                index={idx}
                              >
                                {(dp) => (
                                  <div
                                    ref={dp.innerRef}
                                    {...dp.draggableProps}
                                    {...dp.dragHandleProps}
                                    className='mb-2 last:mb-0 px-2 py-1 rounded-lg bg-zinc-100 text-sm'
                                  >
                                    {p.label}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {prov.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
