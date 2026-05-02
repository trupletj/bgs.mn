"use server";

import { createClient } from "@/utils/supabase/server";

export interface FoodMonthlyReportRow {
  report_month: string;
  dining_hall_id: number;
  dining_hall_name: string | null;
  org_name: string;
  dep_name: string;
  heltes_name: string;
  meal_type: string;
  expected_count: number;
  actual_count: number;
  manual_override_total: number;
  extra_serving_total: number;
  wrong_location_total: number;
}

export interface FoodDailyReportRow {
  report_date: string;
  dining_hall_id: number;
  dining_hall_name: string | null;
  org_name: string;
  dep_name: string;
  heltes_name: string;
  meal_type: string;
  expected_count: number;
  actual_count: number;
  manual_override_total: number;
  extra_serving_total: number;
  wrong_location_total: number;
}

export interface DiningHallOption {
  id: number;
  name: string;
}

function toNumber(value: unknown): number {
  return Number(value || 0);
}

function getMonthRange(month: string) {
  const normalizedMonth = /^\d{4}-\d{2}$/.test(month)
    ? month
    : new Date().toISOString().slice(0, 7);
  const start = `${normalizedMonth}-01`;
  const endDate = new Date(`${start}T00:00:00.000Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  const end = endDate.toISOString().slice(0, 10);

  return { normalizedMonth, start, end };
}

export async function getFoodMonthlyReport(month: string) {
  const supabase = await createClient();
  const { normalizedMonth, start, end } = getMonthRange(month);

  const [{ data: summaryData, error: summaryError }, { data: detailData, error: detailError }, { data: hallsData }] =
    await Promise.all([
      supabase.rpc("get_food_monthly_report", {
        p_month: start,
      }),
      supabase
        .from("food_report_daily_snapshot")
        .select(
          `
          report_date,
          dining_hall_id,
          meal_type,
          org_name,
          dep_name,
          heltes_name,
          expected_count,
          actual_count,
          manual_override_total,
          extra_serving_total,
          wrong_location_total,
          dining_hall ( name )
        `,
        )
        .gte("report_date", start)
        .lt("report_date", end)
        .order("report_date", { ascending: true })
        .order("dining_hall_id", { ascending: true })
        .order("org_name", { ascending: true }),
      supabase.from("dining_hall").select("id, name").order("name"),
    ]);

  if (summaryError) {
    console.error("[food-report] get_food_monthly_report failed:", summaryError.message);
  }
  if (detailError) {
    console.error("[food-report] food_report_daily_snapshot failed:", detailError.message);
  }

  const summary = ((summaryData as unknown[]) || []).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      report_month: String(item.report_month),
      dining_hall_id: toNumber(item.dining_hall_id),
      dining_hall_name: (item.dining_hall_name as string | null) || null,
      org_name: String(item.org_name || ""),
      dep_name: String(item.dep_name || ""),
      heltes_name: String(item.heltes_name || ""),
      meal_type: String(item.meal_type || ""),
      expected_count: toNumber(item.expected_count),
      actual_count: toNumber(item.actual_count),
      manual_override_total: toNumber(item.manual_override_total),
      extra_serving_total: toNumber(item.extra_serving_total),
      wrong_location_total: toNumber(item.wrong_location_total),
    } satisfies FoodMonthlyReportRow;
  });

  const daily = ((detailData as unknown[]) || []).map((row) => {
    const item = row as Record<string, unknown>;
    const diningHall = item.dining_hall as { name?: string | null } | null;
    return {
      report_date: String(item.report_date),
      dining_hall_id: toNumber(item.dining_hall_id),
      dining_hall_name: diningHall?.name || null,
      org_name: String(item.org_name || ""),
      dep_name: String(item.dep_name || ""),
      heltes_name: String(item.heltes_name || ""),
      meal_type: String(item.meal_type || ""),
      expected_count: toNumber(item.expected_count),
      actual_count: toNumber(item.actual_count),
      manual_override_total: toNumber(item.manual_override_total),
      extra_serving_total: toNumber(item.extra_serving_total),
      wrong_location_total: toNumber(item.wrong_location_total),
    } satisfies FoodDailyReportRow;
  });

  const diningHalls = ((hallsData as unknown[]) || []).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: toNumber(item.id),
      name: String(item.name || `Hall #${item.id}`),
    } satisfies DiningHallOption;
  });

  return {
    month: normalizedMonth,
    summary,
    daily,
    diningHalls,
  };
}
