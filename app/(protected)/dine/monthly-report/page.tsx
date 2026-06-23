import { hasPermission } from "@/actions/rbac";
import { getFoodMonthlyReport } from "@/actions/food-report";
import UnauthorizedPage from "@/app/unauthorized/page";
import { MonthlyFoodReport } from "@/components/dine/monthly-food-report";

function getDefaultMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default async function FoodMonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const hasDiningAccess = await hasPermission("dining", "access");
  if (!hasDiningAccess) {
    return <UnauthorizedPage />;
  }

  const resolvedSearchParams = await searchParams;
  const requestedMonth = /^\d{4}-\d{2}$/.test(resolvedSearchParams.month || "")
    ? resolvedSearchParams.month!
    : getDefaultMonth();
  const report = await getFoodMonthlyReport(requestedMonth);

  return (
    <MonthlyFoodReport
      month={report.month}
      summary={report.summary}
      diningHalls={report.diningHalls}
      dates={report.dates}
    />
  );
}
