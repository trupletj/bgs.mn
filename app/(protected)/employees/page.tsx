import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import { columns } from "@/components/users/columns";
import { DataTable } from "@/components/users/data-table";
import { createClient } from "@/utils/supabase/server";

export default async function UsersPage() {
  const supabase = await createClient();
  const canAcess = await hasPermission("employee", "read");

  if (!canAcess) {
    return <UnauthorizedPage />;
  }

  const { data: users, error } = await supabase
    .from("users")
    .select(
      `
      id, first_name, last_name, phone, register_number,
      department_name, heltes_name, position_name, is_active,
      email, address, job_position_id,
      organization:organization_id ( name )
    `,
    )
    .order("created_at", { ascending: false })
    .eq("is_active", true)
    .range(0, 10000);

  const transformedUsers = users?.map((user: any) => ({
    ...user,
    organization_name: user.organization?.name ?? null,
    organization: undefined,
  }));

  const canReadDine = await hasPermission("dining", "read");
  const canEditDine = await hasPermission("dining", "edit");
  const canReadUserDetail = await hasPermission("users_info", "read");

  const permissions = {
    canReadDine,
    canEditDine,
    canReadUserDetail,
    canManageActions: false,
  };

  if (error) return <div>Алдаа: {error.message}</div>;

  return (
    <div className="p-10">
      <div className="text-3xl font-bold mb-6">Хэрэглэгчийн бүртгэл</div>
      <DataTable
        columns={columns}
        data={transformedUsers || []}
        permissions={permissions}
      />
    </div>
  );
}
