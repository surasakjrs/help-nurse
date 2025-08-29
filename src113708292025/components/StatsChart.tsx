'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function StatsChart({
  data,
}: {
  data: Array<{ name: string; main: number; ot: number; weekend: number }>;
}) {
  return (
    <div className='h-64'>
      <ResponsiveContainer
        width='100%'
        height='100%'
      >
        <BarChart data={data}>
          <XAxis dataKey='name' />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey='main' />
          <Bar dataKey='ot' />
          <Bar dataKey='weekend' />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
