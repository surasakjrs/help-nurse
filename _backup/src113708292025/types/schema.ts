export type Role = 'INCHARGE' | 'MED';
export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export interface Workplace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
}

export interface Staff {
  id: string;
  wid: string;
  name: string;
  title: string;
  role: Role;
  active: boolean;
  createdAt: number;
}

export interface PlanMeta {
  id: string;
  wid: string;
  yyyymm: string;
  staffSelected: string[];

  /** เวรหลักเป้าหมายต่อคน */
  mainQuota: Record<string, number>;
  /** ✅ OT “ขั้นต่ำ” ต่อคน (จำนวน OT อย่างน้อยที่ต้องได้ในเดือนนั้น) */
  otMin: Record<string, number>;

  /** วันหยุดของพนักงาน: key=staffId → [1,3,5] */
  dayOff: Record<string, number[]>;

  /** ความต้องการจำนวนคนต่อเวร */
  demandPerShift: Record<ShiftType, number>;

  /** INCHARGE เฉพาะในแต่ละเวร */
  inchargeMin: number;
  inchargeMax: number;

  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Assignment {
  date: string; // YYYY-MM-DD
  shift: ShiftType;
  staffId: string;
  isOT: boolean;
  isWeekend: boolean;
  createdAt: number;
}
