import { getDevices, getOrgStructureForDevices } from "@/actions/devices";
import { hasRole } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DevicesTable } from "@/components/devices/devices-table";

export default async function DevicesPage() {
  const canAccess = await hasRole(["super_admin", "it_engineer"]);
  if (!canAccess) return <UnauthorizedPage />;

  const [{ data: devices }, orgStructure] = await Promise.all([
    getDevices(),
    getOrgStructureForDevices(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">IT Модуль</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Тоног төхөөрөмжийн бүртгэл</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{devices.length} төхөөрөмж бүртгэгдсэн</p>
        </div>
        <Button asChild className="h-9 gap-2 self-start sm:self-auto">
          <Link href="/devices/add">
            <Plus className="h-4 w-4" />
            Шинэ бүртгэл
          </Link>
        </Button>
      </div>

      {/* Table */}
      <DevicesTable data={devices as any} orgStructure={orgStructure} />
    </div>
  );
}
