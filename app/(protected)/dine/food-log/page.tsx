import { hasPermission } from "@/actions/rbac"; // Таны эрх шалгах action
import UnauthorizedPage from "@/app/unauthorized/page";
import FoodLogSummaryTable from "@/components/dine/food-log-summary-table";
import { createClient } from "@/utils/supabase/client";

export default async function FoodLogSummaryPage() {
  const is_access = await hasPermission("dining", "access");
  if (!is_access) {
    return <UnauthorizedPage />;
  }

  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  // 2. Анхны датаг сервер талд татах
  const { data: summaryData } = await supabase
    .from("daily_meal_summary")
    .select(`*, dining_hall ( name )`)
    .eq("date", today)
    .order("grand_total", { ascending: false });

  return (
    <FoodLogSummaryTable initialData={summaryData || []} initialDate={today} />
  );
}
