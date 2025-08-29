'use client';
import AuthGate from '@/components/AuthGate';
import WorkplaceSelect from '@/components/WorkplaceSelect';
import StaffManager from '@/components/StaffManager';
import { addWorkplace } from '@/services/firestore';
import { useState } from 'react';

export default function QuickSetup() {
  const [wid, setWid] = useState('');
  const [name, setName] = useState('');
  return (
    <AuthGate>
      <div className='card p-4 space-y-4'>
        <div className='flex gap-2 flex-col md:flex-row'>
          <input
            className='input flex-1'
            placeholder='ชื่อสถานที่ (เช่น CCU รพ.ศรีสวรรค์)'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className='btn btn-primary'
            onClick={async () => {
              if (!name.trim()) return alert('กรุณากรอกชื่อสถานที่');
              const r = await addWorkplace(name.trim());
              setWid(r.id);
              setName('');
            }}
          >
            เพิ่มสถานที่
          </button>
        </div>
        <div>
          <WorkplaceSelect
            value={wid}
            onChange={setWid}
          />
        </div>
        {wid && (
          <div>
            <h3 className='text-base font-medium mb-2'>พนักงานในสถานที่</h3>
            <StaffManager wid={wid} />
          </div>
        )}
      </div>
    </AuthGate>
  );
}
