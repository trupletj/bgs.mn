"use server";

import { createClient } from "@/utils/supabase/server";

export interface OrderStats {
  total: number;
  pending: number;
  inProgress: number;
  approved: number;
  rejected: number;
}

export interface MonthlyOrderData {
  month: string;
  count: number;
}

export interface OrderStatusCount {
  status: string;
  label: string;
  count: number;
}

export async function getOrderStats(): Promise<OrderStats> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("status");

  if (error || !data) return { total: 0, pending: 0, inProgress: 0, approved: 0, rejected: 0 };

  const total = data.length;
  const pending = data.filter((o) => o.status === "pending").length;
  const inProgress = data.filter((o) =>
    ["in_progress", "created_step"].includes(o.status)
  ).length;
  const approved = data.filter((o) =>
    ["approved", "changes_requested"].includes(o.status)
  ).length;
  const rejected = data.filter((o) => o.status === "rejected").length;

  return { total, pending, inProgress, approved, rejected };
}

export async function getMonthlyOrderTrend(): Promise<MonthlyOrderData[]> {
  const supabase = await createClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("orders")
    .select("created_at")
    .gte("created_at", sixMonthsAgo.toISOString())
    .order("created_at");

  if (error || !data) return [];

  const monthMap = new Map<string, number>();

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, 0);
  }

  data.forEach((order) => {
    const d = new Date(order.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    }
  });

  const monthNames = ["1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар", "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"];

  return Array.from(monthMap.entries()).map(([key, count]) => {
    const monthNum = parseInt(key.split("-")[1]) - 1;
    return { month: monthNames[monthNum], count };
  });
}

export async function getOrderStatusBreakdown(): Promise<OrderStatusCount[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("status");

  if (error || !data) return [];

  const labels: Record<string, string> = {
    pending: "Шинэ",
    in_progress: "Процесс-д",
    created_step: "Үүссэн",
    approved: "Батлагдсан",
    changes_requested: "Өөрчлөлттэй",
    rejected: "Татгалзсан",
  };

  const countMap = new Map<string, number>();
  data.forEach((o) => {
    countMap.set(o.status, (countMap.get(o.status) ?? 0) + 1);
  });

  return Array.from(countMap.entries()).map(([status, count]) => ({
    status,
    label: labels[status] ?? status,
    count,
  }));
}

export async function getPolicyOverview() {
  const supabase = await createClient();

  const [{ count: policyCount }, { count: clauseCount }, { data: ratings }] = await Promise.all([
    supabase.from("policy").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("clause").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("rating").select("score").gte("score", 1).lte("score", 5),
  ]);

  const avgScore =
    ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0;

  return {
    totalPolicies: policyCount ?? 0,
    totalClauses: clauseCount ?? 0,
    averageScore: parseFloat(avgScore.toFixed(2)),
    totalRatings: ratings?.length ?? 0,
  };
}
