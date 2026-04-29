import { getDevice, getOrgStructureForDevices } from "@/actions/devices";
import { hasRole } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DeviceForm } from "@/components/devices/device-form";

export default async function EditDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const canAccess = await hasRole(["super_admin", "it_engineer"]);
  if (!canAccess) return <UnauthorizedPage />;

  const [{ data: device }, orgStructure] = await Promise.all([
    getDevice(id),
    getOrgStructureForDevices(),
  ]);
  if (!device) return notFound();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-2">
        <Link href={`/devices/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-4 w-4" />
          Буцах
        </Link>
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">IT Модуль</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Мэдээлэл засварлах</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{device.name}</p>
        </div>
      </div>
      <DeviceForm mode="edit" device={device as any} orgStructure={orgStructure} />
    </div>
  );
}
