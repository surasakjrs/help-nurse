export type Role = 'ADMIN' | 'STAFF';
export type StaffRole = 'INCHARGE' | 'MED';
export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export interface Workplace {
  id: string;
  ownerId: string;
  name: string;
  unit?: string;
  createdAt?: number;
}

export interface Staff {
  id: string;
  wid: string;
  name: string;
  title?: string;
  role: StaffRole;
  active: boolean;
  createdAt?: number;
}

export interface Planner {
  wid: string;
  ym: string; // YYYY-MM
  demand: Record<ShiftType, number>;
  baseShifts: Record<string, number>; // staffId -> required main shifts
  minOT: Record<string, number>; // staffId -> minimum OT
  dayOff: Record<string, number[]>; // staffId -> [1..31]
  preferences: Record<string, Partial<Record<ShiftType, number>>>; // staffId -> weight (0..1) for each shift
  inchargeMinPerShift: number; // default 1
  inchargeMaxPerShift: number; // default 2
  createdAt?: number;
  updatedAt?: number;
}

export interface Assignment {
  wid: string;
  ym: string;
  day: number; // 1..31
  shift: ShiftType;
  staffIds: string[];
  createdAt?: number;
}

export interface AnalyseReason {
  staffId: string;
  reasons: string[];
}

export interface UserDoc {
  id: string;
  email: string;
  displayName?: string;
  role: Role;
  createdAt?: number;
}
