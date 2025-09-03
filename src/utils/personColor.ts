import type { PersonColorKey } from '@/types/schema';

export const PERSON_COLORS: Record<PersonColorKey, { label: string; cls: string }> = {
  red: { label: 'Red', cls: 'bg-red-300 border-red-600' },
  orange: { label: 'Orange', cls: 'bg-orange-300 border-orange-600' },
  amber: { label: 'Amber', cls: 'bg-amber-300 border-amber-600' },
  yellow: { label: 'Yellow', cls: 'bg-yellow-400 text-black border-yellow-600' },
  lime: { label: 'Lime', cls: 'bg-lime-300 text-black border-lime-600' },
  green: { label: 'Green', cls: 'bg-green-300 border-green-600' },
  emerald: { label: 'Emerald', cls: 'bg-emerald-300 border-emerald-600' },
  teal: { label: 'Teal', cls: 'bg-teal-300 border-teal-600' },
  cyan: { label: 'Cyan', cls: 'bg-cyan-300 text-black border-cyan-600' },
  sky: { label: 'Sky', cls: 'bg-sky-300 border-sky-600' },
  blue: { label: 'Blue', cls: 'bg-blue-300 border-blue-600' },
  indigo: { label: 'Indigo', cls: 'bg-indigo-300 border-indigo-600' },
  violet: { label: 'Violet', cls: 'bg-violet-300 border-violet-600' },
  purple: { label: 'Purple', cls: 'bg-purple-300 border-purple-600' },
  fuchsia: { label: 'Fuchsia', cls: 'bg-fuchsia-300 border-fuchsia-600' },
  pink: { label: 'Pink', cls: 'bg-pink-300 border-pink-600' },
  rose: { label: 'Rose', cls: 'bg-rose-300 border-rose-600' },
  slate: { label: 'Slate', cls: 'bg-slate-300 border-slate-600' },
  stone: { label: 'Stone', cls: 'bg-stone-300 border-stone-600' },
  zinc: { label: 'Zinc', cls: 'bg-zinc-300 border-zinc-600' },
};

export function personPillClass(color?: PersonColorKey | null) {
  return color ? `${PERSON_COLORS[color].cls}` : '';
}

export function personPillLabel(label?: PersonColorKey | null) {
  return label ? `${PERSON_COLORS[label].label}` : 'No Color';
}
