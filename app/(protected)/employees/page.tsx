import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import { columns, type User } from "@/components/users/columns";
import { DataTable } from "@/components/users/data-table";
import { createClient } from "@/utils/supabase/server";
import { Users, UserCheck, Building2 } from "lucide-react";

type EmployeeUserRow = Omit<User, "organization_name"> & {
  bteg_id?: string | null;
  email?: string | null;
  address?: string | null;
  job_position_id?: string | null;
  organization?: { name?: string | null } | null;
};

export default async function UsersPage() {
  const supabase = await createClient();
  const canAccess = await hasPermission("employee", "read");

  if (!canAccess) return <UnauthorizedPage />;

  const { data: users, error } = await supabase
    .from("users")
    .select(
      `id, bteg_id, first_name, last_name, phone, register_number,
       department_name, heltes_name, position_name, is_active,
       email, address, job_position_id,
       organization:organization_id ( name )`,
    )
    .order("created_at", { ascending: false })
    .eq("is_active", true)
    .range(0, 10000);

  if (error) return <div className="p-6 text-destructive">Алдаа: {error.message}</div>;

  const transformedUsers = ((users ?? []) as unknown as EmployeeUserRow[]).map((user) => ({
    ...user,
    organization_name: user.organization?.name ?? null,
    organization: undefined,
  }));

  const [canReadDine, canEditDine, canReadUserDetail] = await Promise.all([
    hasPermission("dining", "read"),
    hasPermission("dining", "edit"),
    hasPermission("users_info", "read"),
  ]);

  const permissions = { canReadDine, canEditDine, canReadUserDetail, canManageActions: false };

  // Stats
  const orgs = new Set(transformedUsers.map((u) => u.organization_name).filter(Boolean));
  const depts = new Set(transformedUsers.map((u) => u.department_name).filter(Boolean));

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Хүний нөөц
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Ажилтны бүртгэл</h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="absolute left-0 top-0 h-0.5 w-full bg-primary opacity-60" />
          <p className="text-xs font-medium text-muted-foreground">Нийт ажилтан</p>
          <div className="mt-3 flex items-end gap-2">
            <p className="text-3xl font-bold tabular-nums">{transformedUsers.length}</p>
            <div className="mb-0.5 rounded-lg bg-primary/10 p-1.5">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="absolute left-0 top-0 h-0.5 w-full bg-emerald-500 opacity-60" />
          <p className="text-xs font-medium text-muted-foreground">Байгууллага</p>
          <div className="mt-3 flex items-end gap-2">
            <p className="text-3xl font-bold tabular-nums">{orgs.size}</p>
            <div className="mb-0.5 rounded-lg bg-emerald-50 p-1.5">
              <Building2 className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="absolute left-0 top-0 h-0.5 w-full bg-violet-500 opacity-60" />
          <p className="text-xs font-medium text-muted-foreground">Алба, хэлтэс</p>
          <div className="mt-3 flex items-end gap-2">
            <p className="text-3xl font-bold tabular-nums">{depts.size}</p>
            <div className="mb-0.5 rounded-lg bg-violet-50 p-1.5">
              <UserCheck className="h-4 w-4 text-violet-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={transformedUsers}
        permissions={permissions}
      />
    </div>
  );
}
