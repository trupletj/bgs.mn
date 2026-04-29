import { hasRole } from "@/actions/rbac";
import { getOrgStructureForDevices } from "@/actions/devices";
import UnauthorizedPage from "@/app/unauthorized/page";
import { DeviceForm } from "@/components/devices/device-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AddDevicePage() {
  const canAccess = await hasRole(["super_admin", "it_engineer"]);
  if (!canAccess) return <UnauthorizedPage />;

  const orgStructure = await getOrgStructureForDevices();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-2">
        <Link href="/devices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-4 w-4" />
          Бүртгэл рүү буцах
        </Link>
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">IT Модуль</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Шинэ тоног төхөөрөмж бүртгэх</h1>
        </div>
      </div>
      <DeviceForm mode="create" orgStructure={orgStructure} />
    </div>
  );
}
