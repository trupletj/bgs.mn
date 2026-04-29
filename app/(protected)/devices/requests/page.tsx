import { hasRole } from "@/actions/rbac";
import { getDeviceRequests, getOrgStructureForDevices } from "@/actions/devices";
import UnauthorizedPage from "@/app/unauthorized/page";
import { DeviceRequestsTable } from "@/components/devices/device-requests-table";

export default async function DeviceRequestsPage() {
  const canAccess = await hasRole(["super_admin", "it_engineer"]);
  if (!canAccess) return <UnauthorizedPage />;

  const [{ data: requests }, orgStructure] = await Promise.all([
    getDeviceRequests(),
    getOrgStructureForDevices(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">IT Модуль</p>
        <h1 className="text-2xl font-bold tracking-tight">Төхөөрөмжийн хүсэлтүүд</h1>
      </div>

      <DeviceRequestsTable data={requests} orgStructure={orgStructure} />
    </div>
  );
}
