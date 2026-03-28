import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import DiningHallEmployees from "@/components/dine/dine-hall-empoyees";
import { createClient } from "@/utils/supabase/client";

interface DineListPageProps {
  params: Promise<{ id: string }>;
}

export default async function DineListPage({ params }: DineListPageProps) {
  const { id } = await params;
  const supabase = createClient();

  const is_access = await hasPermission("dining", "access");
  if (!is_access) return <UnauthorizedPage />;

  const [hallResult, employeesResult] = await Promise.all([
    supabase.from("dining_hall").select("name").eq("id", id).single(),
    supabase
      .from("user_meal_configs")
      .select(
        `
        *,
        users:user_id (
          first_name, last_name, phone, department_name, position_name
        )
      `,
      )
      .or(
        `breakfast_location.eq.${id},lunch_location.eq.${id},dinner_location.eq.${id},night_meal_location.eq.${id},morning_meal_location.eq.${id},extend_morning_meal_location.eq.${id},extend_lunch_location.eq.${id}`,
      ),
  ]);

  return (
    <DiningHallEmployees
      initialEmployees={employeesResult.data || []}
      hallName={hallResult.data?.name || "Гал тогоо"}
      hallId={id}
    />
  );
}
