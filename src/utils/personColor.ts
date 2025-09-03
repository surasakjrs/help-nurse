import type { PersonColorKey } from '@/types/schema';

export const PERSON_COLORS: Record<PersonColorKey, { label: string; cls: string }> = {
  red: { label: 'Red', cls: 'bg-red-500 border-red-600' },
  orange: { label: 'Orange', cls: 'bg-orange-500 border-orange-600' },
  amber: { label: 'Amber', cls: 'bg-amber-500 border-amber-600' },
  yellow: { label: 'Yellow', cls: 'bg-yellow-400 text-black border-yellow-600' },
  lime: { label: 'Lime', cls: 'bg-lime-500 text-black border-lime-600' },
  green: { label: 'Green', cls: 'bg-green-500 border-green-600' },
  emerald: { label: 'Emerald', cls: 'bg-emerald-500 border-emerald-600' },
  teal: { label: 'Teal', cls: 'bg-teal-500 border-teal-600' },
  cyan: { label: 'Cyan', cls: 'bg-cyan-500 text-black border-cyan-600' },
  sky: { label: 'Sky', cls: 'bg-sky-500 border-sky-600' },
  blue: { label: 'Blue', cls: 'bg-blue-500 border-blue-600' },
  indigo: { label: 'Indigo', cls: 'bg-indigo-500 border-indigo-600' },
  violet: { label: 'Violet', cls: 'bg-violet-500 border-violet-600' },
  purple: { label: 'Purple', cls: 'bg-purple-500 border-purple-600' },
  fuchsia: { label: 'Fuchsia', cls: 'bg-fuchsia-500 border-fuchsia-600' },
  pink: { label: 'Pink', cls: 'bg-pink-500 border-pink-600' },
  rose: { label: 'Rose', cls: 'bg-rose-500 border-rose-600' },
  slate: { label: 'Slate', cls: 'bg-slate-500 border-slate-600' },
  stone: { label: 'Stone', cls: 'bg-stone-500 border-stone-600' },
  zinc: { label: 'Zinc', cls: 'bg-zinc-500 border-zinc-600' },
};

export function personPillClass(color?: PersonColorKey | null) {
  return color ? `badge border ${PERSON_COLORS[color].cls}` : 'badge';
}
