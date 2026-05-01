"use server";

import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import type { AttendanceDay } from "@/types/attendance";

const getAttendanceCached = cache(async (): Promise<AttendanceDay[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_attendance");
  if (error) {
    console.error("[attendance] get_my_attendance failed:", error.message);
    return [];
  }
  return ((data as unknown[]) ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      dayDate: String(r.day_date),
      workStartAt: (r.work_start_at as string) ?? null,
      workEndAt: (r.work_end_at as string) ?? null,
      workDuration: (r.work_duration as number) ?? null,
      statusId: (r.status_id as number) ?? null,
      isHotsorson: Boolean(r.is_hotsorson),
      isErtTarsan: Boolean(r.is_ert_tarsan),
      startAt: (r.start_at as string) ?? null,
      endAt: (r.end_at as string) ?? null,
    };
  });
});

export async function getMyAttendance14d() {
  return getAttendanceCached();
}
