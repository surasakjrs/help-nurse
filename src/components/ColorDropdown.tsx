'use client';
import { useState } from 'react';
import type { PersonColorKey } from '@/types/schema';
import { PERSON_COLORS } from '@/utils/personColor';

type Props = {
  value: PersonColorKey | '';
  onChange: (v: PersonColorKey) => void;
  placeholder?: string;
};

export default function ColorDropdown({ value, onChange, placeholder = '— สีประจำตัว —' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className='relative w-48'>
      {/* ปุ่มหลัก */}
      <div
        className='border rounded px-3 py-2 flex items-center justify-between cursor-pointer bg-white'
        onClick={() => setOpen(!open)}
      >
        <span>{value ? PERSON_COLORS[value].label : placeholder}</span>
        <svg
          className={`w-4 h-4 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M19 9l-7 7-7-7'
          />
        </svg>
      </div>

      {/* dropdown list */}
      {open && (
        <div className='absolute z-10 mt-1 w-full bg-white border rounded shadow'>
          {(Object.keys(PERSON_COLORS) as PersonColorKey[]).map((k) => (
            <div
              key={k}
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
              className='px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center'
            >
              <span className={`w-4 h-4 rounded-full mr-2 ${PERSON_COLORS[k].cls.split(' ')[0]}`}></span>
              {PERSON_COLORS[k].label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
