'use client';
import { useEffect, useMemo, useState } from 'react';
import { listWorkplacesByOwner } from '@/services/workplaces.service';
import { useAuth } from '@/context/AuthContext';
import { getAssignmentsByMonth } from '@/services/assignment.service';
import { getPlanner } from '@/services/planner.service';
import { format } from 'date-fns';

function ymNow() {
  const d = new Date();
  return format(d, 'yyyy-MM');
}

export default function StatsDashboard() {
  const { user } = useAuth();
  const [wid, setWid] = useState<string>('');
  const [ym, setYm] = useState<string>(ymNow());
  const [workplaces, setWorkplaces] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [planner, setPlanner] = useState<any>(null);

  useEffect(() => {
    if (user) listWorkplacesByOwner(user.uid).then(setWorkplaces);
  }, [user]);
  useEffect(() => {
    if (wid) getPlanner(wid, ym).then(setPlanner);
  }, [wid, ym]);
  useEffect(() => {
    if (wid) getAssignmentsByMonth(wid, ym).then(setAssignments);
  }, [wid, ym]);

  const stats = useMemo(() => {
    const res: Record<string, { main: number; ot: number; weekend: number }> = {};
    const base = planner?.baseShifts || {};
    for (const a of assignments) {
      const date = new Date(`${ym}-${String(a.day).padStart(2, '0')}T00:00:00`);
      const isWeekend = [0, 6].includes(date.getDay());
      for (const sid of a.staffIds) {
        res[sid] = res[sid] || { main: 0, ot: 0, weekend: 0 };
        const currentMain = res[sid].main + 1;
        const baseReq = base[sid] || 0;
        res[sid].main = currentMain;
        res[sid].ot = Math.max(0, currentMain - baseReq);
        if (isWeekend) res[sid].weekend += 1;
      }
    }
    return res;
  }, [assignments, planner, ym]);

  const ids = Object.keys(stats);

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <h1 className='text-xl font-semibold'>Dashboard</h1>
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
      </div>

      {!wid ? (
        <div className='text-zinc-500'>กรุณาเลือกสถานที่</div>
      ) : (
        <div className='card p-4'>
          <table className='table'>
            <thead>
              <tr>
                <th>พนักงาน (id)</th>
                <th>เวรหลัก</th>
                <th>OT</th>
                <th>Weekend</th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => (
                <tr key={id}>
                  <td>{id}</td>
                  <td>{stats[id].main}</td>
                  <td>{stats[id].ot}</td>
                  <td>{stats[id].weekend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
