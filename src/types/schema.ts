export type Role = 'ADMIN' | 'STAFF';
export type StaffRole = 'INCHARGE' | 'MED';
export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export type Violation = 'NO_INCHARGE' | 'UNDER_STAFFED';
export type AssignmentSource = 'AUTO' | 'MANUAL';

export interface Workplace {
  id: string;
  ownerId: string;
  name: string;
  unit?: string;
  /** รายชื่อผู้ดูแลเพิ่มเติม (หลายแอดมิน) */
  admins?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface Staff {
  id: string;
  wid: string;
  name: string;
  title?: string;
  role: StaffRole;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Planner {
  wid: string;
  ym: string; // YYYY-MM
  /** ความต้องการคนต่อเวร */
  demand: Record<ShiftType, number>;
  /** เวรหลักที่ต้องได้ต่อเดือนของแต่ละคน */
  baseShifts: Record<string, number>; // staffId -> required main shifts
  /** OT ขั้นต่ำของแต่ละคน */
  minOT: Record<string, number>; // staffId -> minimum OT
  /** วันหยุดของแต่ละคน */
  dayOff: Record<string, number[]>; // staffId -> [1..31]
  /** ความชอบเวรของแต่ละคน (0..1) */
  preferences: Record<string, Partial<Record<ShiftType, number>>>;
  /** ขั้นต่ำ/ขั้นสูงของ INCHARGE ต่อ 1 เวร */
  inchargeMinPerShift?: number; // default 1
  inchargeMaxPerShift?: number; // default 2
  /** ปิดเวรดึกของวันสุดท้ายของเดือน */
  skipLastNight?: boolean; // default false
  createdAt?: any;
  updatedAt?: any;
}

export interface Assignment {
  wid: string;
  ym: string;
  day: number; // 1..31
  shift: ShiftType;
  staffIds: string[];
  /** แหล่งที่มา: AUTO (ระบบ), MANUAL (แก้ไขเอง) */
  source?: AssignmentSource;
  /** การละเมิดระดับสล็อต (ไม่มี IC / คนไม่ครบ) */
  violations?: Violation[];
  createdAt?: any;
  updatedAt?: any;
}

export interface AnalyseReason {
  staffId: string;
  reasons: string[]; // เช่น 'dayOff', 'เกิน 2 เวร/วัน', 'ห้าม NIGHT→MORNING วันถัดไป', 'ห้าม 2 เวรคู่เดิมซ้ำเกิน 3 วันติด'
}

export interface UserDoc {
  id: string;
  email: string;
  displayName?: string;
  role: Role;
  createdAt?: any;
  updatedAt?: any;
}
