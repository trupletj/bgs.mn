// types/shift-exchange.ts — bgs_attendance ээлж солилцооны domain type-ууд.
// (bgs.mn-д generated db.ts байхгүй тул RPC/table row-уудыг эдгээр рүү гараар буулгана.)

export type ShiftDirection = "arriving" | "departing";
export type ShiftExchangeStatus =
  | "draft"
  | "published"
  | "completed"
  | "cancelled";

export interface ShiftExchange {
  id: number;
  name: string;
  exchangeDate: string;
  direction: ShiftDirection;
  status: ShiftExchangeStatus;
  openForRegistration: boolean;
  registrationOverrideUntil: string | null;
  notes: string | null;
  createdBy: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ShiftExchangeWithStats extends ShiftExchange {
  busCount: number;
  passengerCount: number;
  confirmedCount: number;
}

export interface AutobusDirection {
  id: string; // uuid
  btegId: string;
  name: string | null;
  zamTsag: number | null;
}

export interface Bus {
  id: number;
  shiftExchangeId: number;
  direction: ShiftDirection;
  name: string;
  description: string | null;
  capacity: number;
  departureTime: string | null;
  tripLeaderId: string | null;
  tripLeaderName: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BusWithStats extends Bus {
  passengerCount: number;
  confirmedCount: number;
  directions: AutobusDirection[];
}

export interface PassengerAssignment {
  id: number;
  shiftExchangeId: number;
  busId: number | null; // null = pool (хуваарилаагүй)
  internalUserId: string;
  isConfirmed: boolean;
  confirmedAt: string | null;
  notes: string | null;
  // denormalized display fields (joined in the action)
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  positionName: string | null;
  albaName: string | null;
  heltesName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  directionBtegId: string | null; // snapshot at assignment time
  directionName: string | null;
  phone: string | null;
  companionGroupId: number | null;
  companionGroupName: string | null;
  eeljGroupId: string | null;
  eeljGroupName: string | null;
}

export interface Organization {
  btegId: string;
  name: string;
}

export interface EeljGroupOption {
  btegId: string;
  name: string;
}

export interface LinkedGroup {
  btegId: string;
  name: string;
}

export interface CompanionGroupMember {
  memberId: number;
  userId: string;
  displayName: string;
  positionName: string | null;
  albaName: string | null;
  phone: string | null;
}

export interface CompanionGroup {
  id: number;
  name: string;
  members: CompanionGroupMember[];
}

export interface BulkAssignResult {
  inserted: number;
  skippedCapacity: number;
}

export interface BulkByOrgResult {
  assigned: number;
  skippedCapacity: number;
}

export interface SubmitPoolResult {
  inserted: number;
  skipped: number;
}

export interface AutoDistributeResult {
  busesCreated: number;
  assigned: number;
  stillPooled: number;
}

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
