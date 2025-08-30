'use client';
import { useEffect, useMemo, useState } from 'react';
import { listWorkplacesByOwner } from '@/services/workplaces.service';
import { useAuth } from '@/context/AuthContext';
import { getAssignmentsByMonth } from '@/services/assignment.service';
import { getPlanner } from '@/services/planner.service';
import { listStaff } from '@/services/staff.service';
import { format } from 'date-fns';
import { useLoading } from '@/context/LoadingContext';
import CalendarGrid from './CalendarGrid';

const SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT'] as const;
type Shift = (typeof SHIFTS)[number];

type AnalyseRes = {
  slot: {
    wid: string;
    ym: string;
    day: number;
    shift: Shift;
    demand: number;
    assignedIds: string[];
    inchargeCount: number;
    inchargeMin: number;
    inchargeMax: number;
  };
  INCHARGE: {
    can: { id: string; name: string; score?: number }[];
    cannot: { id: string; name: string; reasons: string[] }[];
  };
  MED: {
    can: { id: string; name: string; score?: number }[];
    cannot: { id: string; name: string; reasons: string[] }[];
  };
};

function ymNow() {
  const d = new Date();
  return format(d, 'yyyy-MM');
}

export default function CalendarMonth() {
  const { user, isAdmin } = useAuth();
  const { withLoading } = useLoading();
  const [wid, setWid] = useState<string>('');
  const [ym, setYm] = useState<string>(ymNow());
  const [workplaces, setWorkplaces] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [planner, setPlanner] = useState<any>(null);
  const [staffMap, setStaffMap] = useState<Record<string, { id: string; name: string; role: string }>>({});
  const [staffArr, setStaffArr] = useState<Array<{ id: string; name: string; role: string }>>([]);

  // modal analyse (แบบทั้งวัน)
  const [showModal, setShowModal] = useState(false);
  const [analyseDayData, setAnalyseDayData] = useState<Record<Shift, AnalyseRes> | null>(null);
  const [analyseDayNoNight, setAnalyseDayNoNight] = useState(false);
  const [activeTab, setActiveTab] = useState<Shift>('MORNING');

  // inline editor
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [addSelect, setAddSelect] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setWorkplaces(await listWorkplacesByOwner(user.uid));
    })();
  }, [user]);
  useEffect(() => {
    if (!wid) return;
    (async () => {
      setPlanner(await getPlanner(wid, ym));
    })();
  }, [wid, ym]);
  useEffect(() => {
    if (!wid) return;
    (async () => {
      setAssignments(await getAssignmentsByMonth(wid, ym));
    })();
  }, [wid, ym]);

  useEffect(() => {
    if (!wid) {
      setStaffMap({});
      setStaffArr([]);
      return;
    }
    let alive = true;
    (async () => {
      const staff = await listStaff(wid);
      if (!alive) return;
      const map = Object.fromEntries(staff.map((s: any) => [s.id, { id: s.id, name: s.name, role: s.role }]));
      setStaffMap(map);
      setStaffArr(staff.map((s: any) => ({ id: s.id, name: s.name, role: s.role })));
    })();
    return () => {
      alive = false;
    };
  }, [wid]);

  const daysInMonth = useMemo(() => {
    const [Y, M] = ym.split('-').map(Number);
    return new Date(Y, M, 0).getDate();
  }, [ym]);

  const aIndex = useMemo(() => {
    const idx: Record<string, string[]> = {};
    for (const a of assignments) idx[`${a.day}-${a.shift}`] = a.staffIds;
    return idx;
  }, [assignments]);

  const vIndex = useMemo(() => {
    const m: Record<string, string[] | undefined> = {};
    for (const a of assignments) m[`${a.day}-${a.shift}`] = a.violations;
    return m;
  }, [assignments]);

  // ---------- สรุปยอดเวรหลัก / OT / OT ขั้นต่ำ ----------
  const summaryRows = useMemo(() => {
    const rows: Array<{
      id: string;
      name: string;
      role: string;
      base: number;
      minOT: number;
      total: number;
      main: number;
      ot: number;
      deficit: number;
    }> = [];
    if (!planner) return rows;
    const countMap: Record<string, number> = {};
    for (const a of assignments) for (const sid of a.staffIds || []) countMap[sid] = (countMap[sid] ?? 0) + 1;
    for (const id of Object.keys(staffMap)) {
      const { name, role } = staffMap[id];
      const total = countMap[id] ?? 0;
      const base = planner?.baseShifts?.[id] ?? 0;
      const minOT = planner?.minOT?.[id] ?? 0;
      const main = Math.min(total, base);
      const ot = Math.max(0, total - base);
      const deficit = Math.max(0, minOT - ot);
      rows.push({ id, name, role, base, minOT, total, main, ot, deficit });
    }
    rows.sort((a, b) => b.deficit - a.deficit || b.ot - a.ot || a.name.localeCompare(b.name, 'th'));
    return rows;
  }, [assignments, planner, staffMap]);

  const sumMain = useMemo(() => summaryRows.reduce((acc, r) => acc + r.main, 0), [summaryRows]);
  const sumOT = useMemo(() => summaryRows.reduce((acc, r) => acc + r.ot, 0), [summaryRows]);
  const sumMinOT = useMemo(() => summaryRows.reduce((acc, r) => acc + r.minOT, 0), [summaryRows]);
  const sumDeficit = useMemo(() => summaryRows.reduce((acc, r) => acc + r.deficit, 0), [summaryRows]);
  const sumAll = useMemo(() => summaryRows.reduce((acc, r) => acc + r.total, 0), [summaryRows]);

  const chipClass = (s: Shift) => (s === 'MORNING' ? 'chip chip-m' : s === 'AFTERNOON' ? 'chip chip-a' : 'chip chip-n');

  // Auto assign เดียว (ALL)
  async function triggerAssignAll() {
    if (!wid) return;
    await withLoading(async () => {
      await fetch('/api/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wid, ym }),
      });
      const neo = await getAssignmentsByMonth(wid, ym);
      setAssignments(neo);
    }, 'Auto Assign');
  }

  async function clearAuto() {
    if (!wid) return;
    await withLoading(async () => {
      await fetch('/api/assignments/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wid, ym, onlyAuto: true }),
      });
      const neo = await getAssignmentsByMonth(wid, ym);
      setAssignments(neo);
    }, 'ล้าง Auto Assign');
  }

  // ---------- Analyse (ต่อ 1 วัน) ----------
  async function analyseDay(day: number) {
    if (!wid) return;
    const shifts = (['MORNING', 'AFTERNOON', 'NIGHT'] as Shift[]).filter(
      (s) => !(planner?.skipLastNight && s === 'NIGHT' && day === daysInMonth)
    );
    await withLoading(async () => {
      const results = await Promise.all(
        shifts.map((s) =>
          fetch('/api/analyse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wid, ym, day, shift: s }),
          }).then((r) => r.json() as Promise<AnalyseRes>)
        )
      );
      const data: Record<Shift, AnalyseRes> = {} as any;
      results.forEach((r) => {
        data[r.slot.shift] = r;
      });
      setAnalyseDayData(data);
      setActiveTab(shifts[0]);
      setAnalyseDayNoNight(!shifts.includes('NIGHT' as Shift));
      setShowModal(true);
    }, `Analyse D${day}`);
  }

  // ---------- Inline Editor ----------
  function openEditor(day: number, shift: Shift) {
    const k = `${day}-${shift}`;
    setEditingKey(k);
    setDraftIds([...(aIndex[k] || [])]);
    setAddSelect('');
  }
  function cancelEditor() {
    setEditingKey(null);
    setDraftIds([]);
    setAddSelect('');
  }

  function addToDraft() {
    if (!addSelect) return;
    if (!draftIds.includes(addSelect)) setDraftIds([...draftIds, addSelect]);
    setAddSelect('');
  }
  function removeFromDraft(id: string) {
    setDraftIds(draftIds.filter((x) => x !== id));
  }

  async function saveDraft(day: number, shift: Shift) {
    if (!wid) return;
    const payload = { wid, ym, day, shift, staffIds: draftIds };
    await withLoading(async () => {
      await fetch('/api/assignments/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const neo = await getAssignmentsByMonth(wid, ym);
      setAssignments(neo);
    }, 'บันทึกเวร');
    cancelEditor();
  }

  return (
    <div className='space-y-4'>
      {/* Toolbar */}
      <div className='flex flex-col md:flex-row md:flex-wrap md:items-center gap-2'>
        <h1 className='text-xl font-semibold'>ปฏิทินรายเดือน</h1>
        <div className='flex flex-col sm:flex-row gap-2 sm:items-center sm:flex-wrap w-full md:w-auto'>
          <select
            className='select w-full sm:w-64'
            value={wid}
            onChange={(e) => setWid(e.target.value)}
          >
            <option value=''>-- เลือกสถานที่ --</option>
            {workplaces.map((w) => (
              <option
                key={w.id}
                value={w.id}
              >
                {w.name}
              </option>
            ))}
          </select>
          <input
            className='input w-full sm:w-44 md:w-40'
            type='month'
            value={ym}
            onChange={(e) => setYm(e.target.value)}
          />
        </div>

        {wid && (
          <div className='flex flex-wrap items-center gap-2'>
            <a
              className='btn'
              href={`/api/export/xlsx?wid=${wid}&ym=${ym}`}
              target='_blank'
            >
              Export Excel
            </a>
            {isAdmin && (
              <>
                <button
                  className='btn-primary w-full sm:w-auto'
                  onClick={triggerAssignAll}
                >
                  Auto Assign
                </button>
                <button
                  className='btn w-full sm:w-auto'
                  onClick={clearAuto}
                >
                  ล้าง Auto Assign
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* --------- สรุปยอดเดือนนี้ --------- */}
      {wid && planner && (
        <div className='card p-3 sm:p-4 space-y-3'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
            <h2 className='font-medium'>สรุปยอดเดือน {ym}</h2>
            <div className='text-xs sm:text-sm text-zinc-600'>
              เวรหลักรวม: <span className='font-semibold'>{sumMain}</span> &nbsp;|&nbsp; OT รวม:{' '}
              <span className='font-semibold'>{sumOT}</span> &nbsp;|&nbsp; OT ขั้นต่ำรวม:{' '}
              <span className='font-semibold'>{sumMinOT}</span> &nbsp;|&nbsp; ยังขาด OT ขั้นต่ำรวม:{' '}
              <span className='font-semibold'>{sumDeficit}</span> &nbsp;|&nbsp; รวมทั้งหมด:{' '}
              <span className='font-semibold'>{sumAll}</span>
            </div>
          </div>
          {/* เปลี่ยนเป็นตารางเลื่อนแนวนอนบนมือถือ */}
          <div className='overflow-x-auto -mx-3 sm:mx-0'>
            <table className='table min-w-[720px] sm:min-w-[920px]'>
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>บทบาท</th>
                  <th>Base (แผน)</th>
                  <th>OT ขั้นต่ำ</th>
                  <th>ทำจริง</th>
                  <th>เวรหลัก</th>
                  <th>OT ทำจริง</th>
                  <th>ขาด/เกิน OT ขั้นต่ำ</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((r) => (
                  <tr key={r.id}>
                    <td className='whitespace-nowrap'>{r.name}</td>
                    <td>{r.role}</td>
                    <td>{r.base}</td>
                    <td>{r.minOT}</td>
                    <td>{r.total}</td>
                    <td>{r.main}</td>
                    <td>{r.ot}</td>
                    <td>
                      {r.deficit > 0 ? (
                        <span className='badge bg-red-50 border-red-200 text-red-700'>ขาด {r.deficit}</span>
                      ) : (
                        <span className='badge bg-emerald-50 border-emerald-200 text-emerald-700'>
                          เกิน {Math.abs(r.deficit)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!summaryRows.length && (
                  <tr>
                    <td
                      colSpan={8}
                      className='text-center text-zinc-500'
                    >
                      ยังไม่มีข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar grid: 1/2/3/5/7 columns by breakpoint */}
      {!wid ? (
        <div className='text-zinc-500'>กรุณาเลือกสถานที่เพื่อดูปฏิทิน</div>
      ) : (
        <CalendarGrid
          daysInMonth={daysInMonth}
          SHIFTS={SHIFTS}
          aIndex={aIndex}
          vIndex={vIndex}
          isAdmin={isAdmin}
          analyseDay={analyseDay}
          editingKey={editingKey}
          openEditor={openEditor}
          cancelEditor={cancelEditor}
          addSelect={addSelect}
          setAddSelect={setAddSelect}
          addToDraft={addToDraft}
          draftIds={draftIds}
          removeFromDraft={removeFromDraft}
          saveDraft={saveDraft}
          planner={planner}
          staffMap={staffMap}
          staffArr={staffArr}
          chipClass={chipClass}
        />
      )}

      {/* ---------- Modal: Analyse ทั้งวัน (แท็บเช้า/บ่าย/ดึก) ---------- */}
      {showModal && analyseDayData && (
        <div className='fixed inset-0 z-50'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => setShowModal(false)}
          />
          <div className='relative z-10 mx-auto my-0 sm:my-8 w-full sm:max-w-5xl px-0 sm:px-3 h-full sm:h-auto'>
            <div className='card rounded-none sm:rounded-xl p-3 sm:p-4 max-h-full sm:max-h-[80vh] h-full sm:h-auto overflow-auto'>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <h3 className='text-base sm:text-lg font-semibold'>วิเคราะห์รายวัน</h3>
                  <p className='text-xs sm:text-sm text-zinc-600'>
                    {analyseDayNoNight ? 'หมายเหตุ: เวรดึกของวันนี้ถูกปิดตามนโยบาย' : 'รวมทั้ง เช้า/บ่าย/ดึก'}
                  </p>
                </div>
                <button
                  className='btn'
                  onClick={() => setShowModal(false)}
                >
                  ปิด
                </button>
              </div>

              {/* Tabs */}
              <div className='mt-3 sm:mt-4 border-b flex gap-2'>
                {(['MORNING', 'AFTERNOON', 'NIGHT'] as Shift[]).map((s) =>
                  analyseDayData[s] ? (
                    <button
                      key={`tab-${s}`}
                      className={`px-3 py-1.5 text-sm border-b-2 ${
                        activeTab === s ? 'border-zinc-900 font-medium' : 'border-transparent text-zinc-500'
                      }`}
                      onClick={() => setActiveTab(s)}
                    >
                      {s === 'MORNING' ? 'เช้า' : s === 'AFTERNOON' ? 'บ่าย' : 'ดึก'}
                    </button>
                  ) : null
                )}
              </div>

              {/* Content */}
              {analyseDayData[activeTab] && (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4'>
                  {/* INCHARGE */}
                  <section className='space-y-3'>
                    <h4 className='font-medium'>INCHARGE — {activeTab}</h4>
                    <div className='card p-3'>
                      <div className='text-sm font-medium mb-2'>ลงได้</div>
                      {analyseDayData[activeTab].INCHARGE.can.length ? (
                        <ul className='list-disc list-inside space-y-1'>
                          {analyseDayData[activeTab].INCHARGE.can.map((x) => (
                            <li key={`ic-can-${x.id}`}>
                              {x.name}
                              {typeof x.score === 'number' && (
                                <span className='text-xs text-zinc-600'> (score {x.score.toFixed(2)})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className='text-zinc-500 text-sm'>-</div>
                      )}
                    </div>
                    <div className='card p-3'>
                      <div className='text-sm font-medium mb-2'>ลงไม่ได้</div>
                      {analyseDayData[activeTab].INCHARGE.cannot.length ? (
                        <ul className='space-y-2'>
                          {analyseDayData[activeTab].INCHARGE.cannot.map((x) => (
                            <li key={`ic-no-${x.id}`}>
                              <div className='font-medium'>{x.name}</div>
                              <div className='text-sm text-zinc-600'>เหตุผล: {x.reasons.join(', ')}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className='text-zinc-500 text-sm'>-</div>
                      )}
                    </div>
                  </section>

                  {/* MED */}
                  <section className='space-y-3'>
                    <h4 className='font-medium'>MED — {activeTab}</h4>
                    <div className='card p-3'>
                      <div className='text-sm font-medium mb-2'>ลงได้</div>
                      {analyseDayData[activeTab].MED.can.length ? (
                        <ul className='list-disc list-inside space-y-1'>
                          {analyseDayData[activeTab].MED.can.map((x) => (
                            <li key={`med-can-${x.id}`}>
                              {x.name}
                              {typeof x.score === 'number' && (
                                <span className='text-xs text-zinc-600'> (score {x.score.toFixed(2)})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className='text-zinc-500 text-sm'>-</div>
                      )}
                    </div>
                    <div className='card p-3'>
                      <div className='text-sm font-medium mb-2'>ลงไม่ได้</div>
                      {analyseDayData[activeTab].MED.cannot.length ? (
                        <ul className='space-y-2'>
                          {analyseDayData[activeTab].MED.cannot.map((x) => (
                            <li key={`med-no-${x.id}`}>
                              <div className='font-medium'>{x.name}</div>
                              <div className='text-sm text-zinc-600'>เหตุผล: {x.reasons.join(', ')}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className='text-zinc-500 text-sm'>-</div>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
