'use client';
import { useEffect, useMemo, useState } from 'react';
import { listWorkplacesByOwner } from '@/services/workplaces.service';
import { useAuth } from '@/context/AuthContext';
import { getAssignmentsByMonth } from '@/services/assignment.service';
import { getPlanner } from '@/services/planner.service';
import { listStaff } from '@/services/staff.service';
import { format } from 'date-fns';
import { useLoading } from '@/context/LoadingContext';

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
  const [wid, setWid] = useState<string>('');
  const [ym, setYm] = useState<string>(ymNow());
  const [workplaces, setWorkplaces] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [planner, setPlanner] = useState<any>(null);
  const [staffMap, setStaffMap] = useState<Record<string, { id: string; name: string; role: string }>>({});

  // modal state
  const [showModal, setShowModal] = useState(false);
  const [analyseData, setAnalyseData] = useState<AnalyseRes | null>(null);
  const [loadingAnalyse, setLoadingAnalyse] = useState(false);

  const { withLoading } = useLoading();

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
      return;
    }
    let alive = true;
    (async () => {
      const staff = await listStaff(wid);
      if (!alive) return;
      const map = Object.fromEntries(staff.map((s: any) => [s.id, { id: s.id, name: s.name, role: s.role }]));
      setStaffMap(map);
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
    for (const a of assignments) {
      for (const sid of a.staffIds || []) {
        countMap[sid] = (countMap[sid] ?? 0) + 1;
      }
    }
    const ids = Object.keys(staffMap);
    for (const id of ids) {
      const name = staffMap[id].name;
      const role = staffMap[id].role;
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

  // ✅ แก้ให้ Analyse แสดงผลใน modal
  async function analyse(day: number, shift: Shift) {
    setLoadingAnalyse(true);
    try {
      const res: AnalyseRes = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wid, ym, day, shift }),
      }).then((r) => r.json());
      setAnalyseData(res);
      setShowModal(true);
    } finally {
      setLoadingAnalyse(false);
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <h1 className='text-xl font-semibold'>ปฏิทินรายเดือน</h1>
        <select
          className='select w-64'
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
          className='input w-40'
          type='month'
          value={ym}
          onChange={(e) => setYm(e.target.value)}
        />
        {wid && (
          <>
            <a
              className='btn'
              href={`/api/export/csv?wid=${wid}&ym=${ym}`}
              target='_blank'
            >
              Export CSV
            </a>
            <a
              className='btn'
              href={`/api/export/pdf?wid=${wid}&ym=${ym}`}
              target='_blank'
            >
              Export PDF
            </a>
            {isAdmin && (
              <>
                <button
                  className='btn-primary'
                  onClick={triggerAssignAll}
                >
                  Auto Assign
                </button>
                <button
                  className='btn'
                  onClick={clearAuto}
                >
                  ล้าง Auto Assign
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* --------- สรุปยอดเดือนนี้ --------- */}
      {wid && planner && (
        <div className='card p-4 space-y-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <h2 className='font-medium'>สรุปยอดเดือน {ym}</h2>
            <div className='text-sm text-zinc-600'>
              เวรหลักรวม: <span className='font-semibold'>{sumMain}</span> &nbsp;|&nbsp; OT รวม:{' '}
              <span className='font-semibold'>{sumOT}</span> &nbsp;|&nbsp; OT ขั้นต่ำรวม:{' '}
              <span className='font-semibold'>{sumMinOT}</span> &nbsp;|&nbsp; ยังขาด OT ขั้นต่ำรวม:{' '}
              <span className='font-semibold'>{sumDeficit}</span> &nbsp;|&nbsp; รวมทั้งหมด:{' '}
              <span className='font-semibold'>{sumAll}</span>
            </div>
          </div>
          <div className='overflow-auto'>
            <table className='table min-w-[920px]'>
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

      {!wid ? (
        <div className='text-zinc-500'>กรุณาเลือกสถานที่เพื่อดูปฏิทิน</div>
      ) : (
        <div className='grid grid-cols-7 gap-2'>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
            <div
              key={day}
              className='cell'
            >
              <div className='date'>{day}</div>
              <div className='space-y-2 mt-6 text-sm'>
                {(['MORNING', 'AFTERNOON', 'NIGHT'] as const).map((s) => {
                  const k = `${day}-${s}`;
                  const ids = aIndex[k] || [];
                  const vios = vIndex[k] || [];
                  return (
                    <div
                      key={s}
                      className='shift-row'
                    >
                      <div
                        className={
                          'shift-pill ' + (s === 'MORNING' ? 'shift-m' : s === 'AFTERNOON' ? 'shift-a' : 'shift-n')
                        }
                      >
                        {s === 'MORNING' ? 'M' : s === 'AFTERNOON' ? 'A' : 'N'}
                      </div>
                      <div className='flex flex-wrap gap-1 items-center'>
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
                          <span className='ml-1 text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200'>
                            ไม่มี INCHARGE
                          </span>
                        )}
                        {vios?.includes('UNDER_STAFFED') && (
                          <span className='ml-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200'>
                            คนไม่ครบ
                          </span>
                        )}

                        <button
                          className='analyse-btn'
                          onClick={() => analyse(day, s)}
                          disabled={loadingAnalyse}
                          title='Analyse'
                        >
                          {loadingAnalyse ? 'กำลังวิเคราะห์...' : 'Analyse'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- Modal: Analyse ---------- */}
      {showModal && analyseData && (
        <div className='fixed inset-0 z-50'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => setShowModal(false)}
          />
          <div className='relative z-10 mx-auto my-8 w-full max-w-3xl px-3'>
            <div className='card p-4 max-h-[80vh] overflow-auto'>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <h3 className='text-lg font-semibold'>
                    วิเคราะห์เวร {analyseData.slot.shift} วันที่ {analyseData.slot.day}
                  </h3>
                  <p className='text-sm text-zinc-600'>
                    ต้องการคน: <b>{analyseData.slot.demand}</b> · INCHARGE ปัจจุบัน:{' '}
                    <b>{analyseData.slot.inchargeCount}</b> (min {analyseData.slot.inchargeMin}, max{' '}
                    {analyseData.slot.inchargeMax})
                  </p>
                </div>
                <button
                  className='btn'
                  onClick={() => setShowModal(false)}
                >
                  ปิด
                </button>
              </div>

              <div className='grid md:grid-cols-2 gap-4 mt-4'>
                {/* INCHARGE */}
                <section className='space-y-3'>
                  <h4 className='font-medium'>INCHARGE</h4>

                  <div className='card p-3'>
                    <div className='text-sm font-medium mb-2'>ลงได้</div>
                    {analyseData.INCHARGE.can.length ? (
                      <ul className='list-disc list-inside space-y-1'>
                        {analyseData.INCHARGE.can.map((x) => (
                          <li key={`ic-can-${x.id}`}>
                            {x.name}{' '}
                            {typeof x.score === 'number' && (
                              <span className='text-xs text-zinc-600'>(score {x.score.toFixed(2)})</span>
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
                    {analyseData.INCHARGE.cannot.length ? (
                      <ul className='space-y-2'>
                        {analyseData.INCHARGE.cannot.map((x) => (
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
                  <h4 className='font-medium'>MED</h4>

                  <div className='card p-3'>
                    <div className='text-sm font-medium mb-2'>ลงได้</div>
                    {analyseData.MED.can.length ? (
                      <ul className='list-disc list-inside space-y-1'>
                        {analyseData.MED.can.map((x) => (
                          <li key={`med-can-${x.id}`}>
                            {x.name}{' '}
                            {typeof x.score === 'number' && (
                              <span className='text-xs text-zinc-600'>(score {x.score.toFixed(2)})</span>
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
                    {analyseData.MED.cannot.length ? (
                      <ul className='space-y-2'>
                        {analyseData.MED.cannot.map((x) => (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
