export default function ShiftLegend() {
  return (
    <div className='flex flex-wrap gap-2 text-xs'>
      <span className='px-2 py-1 rounded-full bg-zinc-100'>MORNING</span>
      <span className='px-2 py-1 rounded-full bg-zinc-100'>AFTERNOON</span>
      <span className='px-2 py-1 rounded-full bg-zinc-100'>NIGHT</span>
      <span className='px-2 py-1 rounded-full bg-amber-100'>INCHARGE</span>
      <span className='px-2 py-1 rounded-full bg-emerald-100'>OT</span>
      <span className='px-2 py-1 rounded-full bg-sky-100'>Weekend</span>
    </div>
  );
}
