export interface AttendanceDay {
  dayDate: string;
  workStartAt: string | null;
  workEndAt: string | null;
  workDuration: number | null;
  statusId: number | null;
  isHotsorson: boolean;
  isErtTarsan: boolean;
  startAt: string | null;
  endAt: string | null;
}
