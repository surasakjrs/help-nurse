'use client';
import { useState } from 'react';

export default function WorkplaceForm({ onSubmit }: { onSubmit: (v: { name: string; unit?: string }) => Promise<void> }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  return (
    <div className="card p-4 space-y-4">
      <div className="grid md:grid-cols-3 gap-2">
        <input className="input" placeholder="ชื่อสถานที่ (ICU / ER / CCU)" value={name} onChange={e=>setName(e.target.value)} />
        <input className="input" placeholder="หน่วย/ชั้น/รายละเอียด" value={unit} onChange={e=>setUnit(e.target.value)} />
        <button className="btn-primary" onClick={async ()=>{ await onSubmit({ name, unit }); setName(''); setUnit(''); }}>เพิ่ม</button>
      </div>
    </div>
  );
}
