import { columns } from "@/components/users/columns";
import { DataTable } from "@/components/users/data-table";
import { createClient } from "@/utils/supabase/server";

export default async function UsersPage() {
  const supabase = await createClient();

  const { data: users, error } = await supabase
    .from("users")
    .select(
      "id, first_name, last_name, phone, register_number, department_name, heltes_name, position_name, is_active, email, address",
    )
    .order("created_at", { ascending: false })
    .eq("is_active", true);

  if (error) return <div>Алдаа: {error.message}</div>;

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold mb-6">Хэрэглэгчийн бүртгэл</h1>
      <DataTable columns={columns} data={users || []} />
    </div>
  );
}
