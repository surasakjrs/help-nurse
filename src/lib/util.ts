import type { ShiftType } from '@/types/schema';

export const SHIFTS: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];

export function daysIn(ym: string): number {
  const [Y, M] = ym.split('-').map(Number);
  return new Date(Y, M, 0).getDate();
}

export function prevDay(ym: string, day: number) {
  return day > 1 ? { ym, day: day - 1 } : null;
}
