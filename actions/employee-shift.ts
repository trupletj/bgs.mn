"use server";

import { createClient } from "@/utils/supabase/server";

export interface EmployeeShiftInfo {
  dayDate: string | null;
  startAt: string | null;
  endAt: string | null;
  currentGroupName: string | null;
  shiftType: string | null;
  isWorking: boolean;
}

export async function getEmployeeShiftInfo(
  btegId?: string | null,
): Promise<EmployeeShiftInfo | null> {
  if (!btegId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_employee_shift_for_modal", { p_bteg_id: btegId })
    .maybeSingle();

  if (error) {
    console.error("[employee-shift] get_employee_shift_for_modal:", error);
    return null;
  }

  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    dayDate: (row.day_date as string) ?? null,
    startAt: (row.start_at as string) ?? null,
    endAt: (row.end_at as string) ?? null,
    currentGroupName: (row.current_group_name as string) ?? null,
    shiftType: (row.shift_type as string) ?? null,
    isWorking: Boolean(row.is_working),
  };
}
