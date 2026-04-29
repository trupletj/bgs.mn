import { getDevice, getDeviceHistory, getDeviceMaintenance } from "@/actions/devices";
import { hasRole } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DeviceStatusBadge, DeviceTypeBadge } from "@/components/devices/device-status-badge";
import {
  AssignmentPanel, MaintenancePanel, HistoryPanel, StatusChangePanel,
} from "@/components/devices/device-detail-panels";
import {
  ArrowLeft, Edit, Monitor, Laptop2, Printer, Package2,
} from "lucide-react";
import { DeleteDeviceButton } from "@/components/devices/delete-device-button";
import { DEVICE_TYPE_CONFIG, type DeviceType } from "@/types/device";
import { cn } from "@/lib/utils";

function formatDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

const TYPE_ICON: Partial<Record<DeviceType, React.ElementType>> = {
  desktop: Monitor, laptop: Laptop2, printer: Printer,
  scanner: Printer, monitor: Monitor,
};

function SpecRow({ label, value }: { label: string; value?: string | number | boolean }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center justify-between py-2 text-sm border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{typeof value === "boolean" ? (value ? "Тийм" : "Үгүй") : value}</span>
    </div>
  );
}

export default async function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const canAccess = await hasRole(["super_admin", "it_engineer"]);
  if (!canAccess) return <UnauthorizedPage />;

  const [{ data: device }, { data: history }, { data: maintenance }] = await Promise.all([
    getDevice(id),
    getDeviceHistory(id),
    getDeviceMaintenance(id),
  ]);

  if (!device) return notFound();

  const Icon = TYPE_ICON[device.device_type as DeviceType] ?? Package2;
  const typeCfg = DEVICE_TYPE_CONFIG[device.device_type as DeviceType];
  const specs = (device.specs ?? {}) as Record<string, any>;
  const isExpiredWarranty = device.warranty_expiry_date && new Date(device.warranty_expiry_date) < new Date();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Back + header */}
      <div className="flex flex-col gap-3">
        <Link href="/devices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-4 w-4" />
          Бүртгэл рүү буцах
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{device.name}</h1>
                <DeviceStatusBadge status={device.status} />
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <DeviceTypeBadge type={device.device_type} />
                {device.model && <span className="text-sm text-muted-foreground">{device.model}</span>}
                {device.manufacturer && <span className="text-sm text-muted-foreground">· {device.manufacturer}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <StatusChangePanel deviceId={device.id} currentStatus={device.status as any} />
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Link href={`/devices/${id}/edit`}><Edit className="h-3.5 w-3.5" />Засварлах</Link>
            </Button>
            <DeleteDeviceButton deviceId={device.id} deviceName={device.name} />
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-6 lg:col-span-2">

          {/* Basic info */}
          <section className="rounded-xl border border-border bg-card">
            <div className="border-b border-border/60 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Үндсэн мэдээлэл</h2>
            </div>
            <div className="px-5 py-2">
              <SpecRow label="Серийн дугаар" value={device.serial_number} />
              <SpecRow label="Байршил" value={device.location} />
              <SpecRow label="Байгууллага" value={(device as any).organization?.name ?? undefined} />
              <SpecRow label="Хэлтэс" value={(device as any).heltes?.name ?? device.heltes_name ?? undefined} />
              <SpecRow label="Алба" value={(device as any).alba?.name ?? device.department_name ?? undefined} />
              <SpecRow label="Худалдан авсан огноо" value={formatDate(device.purchase_date)} />
              <SpecRow
                label="Баталгаат хугацаа"
                value={device.warranty_expiry_date
                  ? `${formatDate(device.warranty_expiry_date)}${isExpiredWarranty ? " (дууссан)" : ""}`
                  : undefined}
              />
              {device.notes && (
                <div className="py-3 text-sm">
                  <p className="text-muted-foreground mb-1">Тэмдэглэл</p>
                  <p className="text-foreground">{device.notes}</p>
                </div>
              )}
            </div>
          </section>

          {/* Specs */}
          {Object.keys(specs).length > 0 && (
            <section className="rounded-xl border border-border bg-card">
              <div className="border-b border-border/60 px-5 py-3.5">
                <h2 className="text-sm font-semibold">Техникийн үзүүлэлт</h2>
              </div>
              <div className="px-5 py-2">
                <SpecRow label="CPU" value={specs.cpu} />
                <SpecRow label="RAM" value={specs.ram_gb ? `${specs.ram_gb} GB` : undefined} />
                <SpecRow label="SSD" value={specs.ssd_gb ? `${specs.ssd_gb} GB` : undefined} />
                <SpecRow label="HDD" value={specs.hdd_gb ? `${specs.hdd_gb} GB` : undefined} />
                <SpecRow label="GPU" value={specs.gpu} />
                <SpecRow label="Үйлдлийн систем" value={specs.os} />
                <SpecRow label="Дэлгэцийн хэмжээ" value={specs.size_inch ? `${specs.size_inch}"` : undefined} />
                <SpecRow label="Нягтрал" value={specs.resolution} />
                <SpecRow label="Панелийн төрөл" value={specs.panel_type} />
                <SpecRow label="Холболт" value={specs.connection} />
                <SpecRow label="Өнгөт хэвлэлт" value={specs.color_capable} />
              </div>
            </section>
          )}

          {/* Maintenance */}
          <section className="rounded-xl border border-border bg-card">
            <div className="border-b border-border/60 px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Засварын бүртгэл</h2>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{maintenance.length}</span>
            </div>
            <div className="p-5">
              <MaintenancePanel deviceId={device.id} records={maintenance as any} />
            </div>
          </section>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4">
          {/* Assignments */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border/60 px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Хариуцагчид</h2>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {device.device_assignments?.length ?? 0}
              </span>
            </div>
            <div className="p-4">
              <AssignmentPanel deviceId={device.id} assignments={device.device_assignments as any ?? []} />
            </div>
          </div>

          {/* History */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border/60 px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Өөрчлөлтийн түүх</h2>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{history.length}</span>
            </div>
            <div className="p-4">
              <HistoryPanel records={history as any} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
