import { hasRole } from "@/actions/rbac";
import { getDevices, getDeviceRequests, getOrgStructureForDevices } from "@/actions/devices";
import UnauthorizedPage from "@/app/unauthorized/page";
import { DeviceReportDashboard } from "@/components/devices/device-report-dashboard";

export default async function DeviceReportPage() {
  const canAccess = await hasRole(["super_admin", "it_engineer"]);
  if (!canAccess) return <UnauthorizedPage />;

  const [{ data: devices }, { data: requests }, orgStructure] = await Promise.all([
    getDevices(),
    getDeviceRequests(),
    getOrgStructureForDevices(),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">IT Модуль</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Тайлан</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Төхөөрөмж, хүсэлтийн нэгтгэсэн интерактив тайлан
        </p>
      </div>

      <DeviceReportDashboard
        devices={devices as any}
        requests={requests as any}
        orgStructure={orgStructure}
      />
    </div>
  );
}
