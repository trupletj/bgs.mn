import { redirect } from "next/navigation";
import { hasPermission } from "@/actions/rbac";
import { getShiftExchanges } from "@/actions/shift-exchange";
import { ReportClient } from "@/components/shift-exchange/report-client";

export default async function ReportsPage() {
  const [canView] = await Promise.all([
    hasPermission("shift_exchange", "view"),
  ]);
  if (!canView) redirect("/unauthorized");

  const exchanges = await getShiftExchanges();
  return <ReportClient exchanges={exchanges} />;
}
