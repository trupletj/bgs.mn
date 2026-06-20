import { getMyAttendance14d } from "@/actions/attendance";
import { AttendanceMiniAppTabs } from "@/components/attendance/attendance-mini-app-tabs";

export default async function AttendancePage() {
  const days = await getMyAttendance14d();

  return <AttendanceMiniAppTabs days={days} />;
}
