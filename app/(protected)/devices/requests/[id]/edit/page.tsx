import { hasRole } from "@/actions/rbac";
import {
  getDeviceRequest, getOrgStructureForDevices,
  getDeviceRequestComments, getDeviceRequestStatusHistory,
  getEligibleTransferRequests, getEligibleTargetRequests,
} from "@/actions/devices";
import UnauthorizedPage from "@/app/unauthorized/page";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DeviceRequestEditForm } from "@/components/devices/device-request-edit-form";

export default async function EditDeviceRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const canAccess = await hasRole(["super_admin", "it_engineer"]);
  if (!canAccess) return <UnauthorizedPage />;

  const { id } = await params;

  const [{ data: request, error }, orgStructure, comments, statusHistory] = await Promise.all([
    getDeviceRequest(id),
    getOrgStructureForDevices(),
    getDeviceRequestComments(id),
    getDeviceRequestStatusHistory(id),
  ]);

  if (error || !request) {
    console.error("getDeviceRequest error:", error);
    return (
      <div className="p-6 text-sm text-destructive">
        Хүсэлт олдсонгүй: {error?.message ?? "өгөгдөл байхгүй"}
      </div>
    );
  }

  // For 'new'/'replace' requests, fetch matching transfer requests for linking.
  // For 'transfer' requests, fetch matching new/replace requests this transfer could fulfill.
  const [eligibleTransfers, eligibleTargets] = await Promise.all([
    (request.request_type === "new" || request.request_type === "replace")
      ? getEligibleTransferRequests(request.device_type ?? undefined, id)
      : Promise.resolve([]),
    request.request_type === "transfer"
      ? getEligibleTargetRequests(request.device_type ?? undefined, id)
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/devices/requests"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Хүсэлтүүд рүү буцах
        </Link>
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">IT Модуль</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Хүсэлт засах</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Бүх талбарыг засварлах боломжтой</p>
        </div>
      </div>

      <DeviceRequestEditForm
        requestId={id}
        orgStructure={orgStructure}
        initialData={request}
        initialComments={comments}
        statusHistory={statusHistory}
        eligibleTransfers={eligibleTransfers}
        eligibleTargets={eligibleTargets}
      />
    </div>
  );
}
