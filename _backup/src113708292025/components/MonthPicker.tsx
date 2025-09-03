'use client';
import { format } from 'date-fns';
import { useState } from 'react';

export default function MonthPicker({ value, onChange }: { value: string; onChange: (yyyymm: string) => void }) {
  const [local, setLocal] = useState(value);
  return (
    <input
      type='month'
      className='input'
      value={`${local.slice(0, 4)}-${local.slice(4)}`}
      onChange={(e) => {
        const v = e.target.value; // YYYY-MM
        const yyyymm = v.replace('-', '');
        setLocal(yyyymm);
        onChange(yyyymm);
      }}
    />
  );
}
