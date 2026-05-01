export interface EeljShift {
  id: number;
  name: string;
  dayDate: string;
  isCome: boolean;
}

export interface MyEeljAssignment {
  eeljId: number;
  eeljName: string;
  dayDate: string;
  isCome: boolean;
  autobusId: number | null;
  autobusNumber: string | null;
  directionName: string | null;
  driverName: string | null;
  driverPhone: string | null;
  sitNumber: number | null;
  landPositionAddress: string | null;
  isDone: boolean;
}

export interface RosterEntry {
  autobusId: number;
  autobusNumber: string;
  dayDate: string;
  eeljId: number;
  eeljName: string;
  isCome: boolean;
  directionName: string | null;
  passengerBtegId: string | null;
  passengerFirstName: string | null;
  passengerLastName: string | null;
  passengerPhone: string | null;
  sitNumber: number | null;
  landPositionAddress: string | null;
  isDone: boolean;
}

export interface RosterAutobus {
  autobusId: number;
  autobusNumber: string;
  dayDate: string;
  eeljId: number;
  eeljName: string;
  isCome: boolean;
  directionName: string | null;
  passengers: RosterEntry[];
}

export type EeljRequestStatus =
  | "requested"
  | "approved"
  | "force_approved"
  | "rejected";

export interface MyEeljRequest {
  id: number;
  eeljId: number;
  eeljName: string;
  autobusId: number;
  autobusNumber: string | null;
  directionName: string | null;
  status: EeljRequestStatus;
  comment: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
}

export interface PendingRequest {
  id: number;
  eeljId: number;
  eeljName: string;
  autobusId: number;
  autobusNumber: string | null;
  directionName: string | null;
  requesterBtegId: number | null;
  requesterFirstName: string | null;
  requesterLastName: string | null;
  requesterPhone: string | null;
  requesterPosition: string | null;
  requesterDepartment: string | null;
  status: EeljRequestStatus;
  comment: string | null;
  requestedAt: string;
}

export interface RequestableAutobus {
  autobusId: number;
  autobusNumber: string;
  eeljId: number;
  eeljName: string;
  dayDate: string;
  isCome: boolean;
  directionName: string | null;
  driverName: string | null;
  alreadyRequested: boolean;
}

export interface EeljCard {
  eeljId: number;
  eeljName: string;
  dayDate: string;
  isCome: boolean;
  autobusId: number;
  autobusNumber: string;
  directionName: string | null;
  driverName: string | null;
  driverPhone: string | null;
  leaderName: string | null;
  zamTsag: number | null;
  zamTsagDayDate: string | null;
  isMyAssignment: boolean;
  requestId: number | null;
  requestStatus: EeljRequestStatus | null;
  requestDecisionReason: string | null;
}
