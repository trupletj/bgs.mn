"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  updateDeviceRequest, addDeviceRequestComment, assignTransferToRequest, deleteDeviceRequest,
  createDeviceRequest, searchProfiles, searchITStaff,
  type DeviceRequestType, type DeviceRequestPriority, type DeviceRequestStatus,
} from "@/actions/devices";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { DEVICE_TYPE_CONFIG, type DeviceType, type OrgStructure } from "@/types/device";
import { cn } from "@/lib/utils";
import {
  NONE, FieldLabel, Section, OrgCascade,
  DeviceSpecsFields, EMPTY_SPECS, specsStateFromJsonb, buildSpecsFromState,
  DevicePicker, type PickedDevice,
  UserPicker, type PickedUser,
  ProfilePicker, type PickedProfile,
  REQUEST_TYPE_CONFIG, PRIORITY_CONFIG,
  getDeviceTypeIcon, formatDeviceSpecs,
} from "@/components/devices/request-shared";
import {
  Send, Link2, Unlink, ArrowRight, Clock, Monitor,
  Calendar, Building2, User as UserIcon,
} from "lucide-react";
import Link from "next/link";

const DEVICE_TYPES = Object.entries(DEVICE_TYPE_CONFIG) as [DeviceType, { label: string }][];

const STATUS_LABELS: Record<DeviceRequestStatus, string> = {
  pending: "Хүлээгдэж буй", approved: "Зөвшөөрөгдсөн", rejected: "Татгалзсан",
};
const STATUS_COLORS: Record<DeviceRequestStatus, string> = {
  pending:  "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

function formatDateTime(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

interface Comment {
  id: string; body: string; created_at: string; author?: { name: string } | null;
}
interface StatusHistory {
  id: string; from_status: string | null; to_status: string;
  note: string | null; created_at: string; changer?: { name: string } | null;
}

interface Props {
  requestId: string;
  orgStructure: OrgStructure;
  initialData: any;
  initialComments: Comment[];
  statusHistory: StatusHistory[];
  eligibleTransfers: any[];
  eligibleTargets?: any[];
}

export function DeviceRequestEditForm({
  requestId, orgStructure, initialData: r, initialComments, statusHistory, eligibleTransfers, eligibleTargets = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [postingComment, startComment] = useTransition();
  const [assigning, startAssign] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [addingMonitor, startAddMonitor] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Дэлгэц нэмэх (existing request дээр) ──
  const [showAddMonitor, setShowAddMonitor] = useState(false);
  const [newMonitorSpecs, setNewMonitorSpecs] = useState(EMPTY_SPECS);

  const orgIdFromBteg    = (b: string) => orgStructure.organizations.find(o => o.bteg_id === b)?.id ?? "";
  const heltesIdFromBteg = (b: string) => orgStructure.heltes.find(h => h.bteg_id === b)?.id ?? "";
  const albaIdFromBteg   = (b: string) => orgStructure.alba.find(a => a.bteg_id === b)?.id ?? "";

  // ── Type + priority ──
  const [requestType, setRequestType] = useState<DeviceRequestType>(r.request_type ?? "new");
  const [priority, setPriority] = useState<DeviceRequestPriority>(r.priority ?? "normal");

  // ── Requester profile ──
  const [requester, setRequester] = useState<PickedProfile | null>(
    r.creator && r.created_by
      ? { id: r.created_by as number, name: r.creator.name, department_name: r.creator.department_name, position_name: r.creator.position_name }
      : null
  );

  // ── Assigned IT staff ──
  const [assignee, setAssignee] = useState<PickedProfile | null>(
    r.assignee && r.assigned_to
      ? { id: r.assigned_to as number, name: r.assignee.name, department_name: r.assignee.department_name, position_name: r.assignee.position_name }
      : null
  );

  // ── Requester dept ──
  const [reqOrgId, setReqOrgId]       = useState(() => orgIdFromBteg(r.req_org_bteg ?? ""));
  const [reqHeltesId, setReqHeltesId] = useState(() => heltesIdFromBteg(r.req_heltes_bteg ?? ""));
  const [reqAlbaId, setReqAlbaId]     = useState(() => albaIdFromBteg(r.req_alba_bteg ?? ""));
  const reqOrgBteg    = orgStructure.organizations.find((o) => o.id === reqOrgId)?.bteg_id ?? "";
  const reqHeltesBteg = orgStructure.heltes.find((h) => h.id === reqHeltesId)?.bteg_id ?? "";
  const reqAlbaBteg   = orgStructure.alba.find((a) => a.id === reqAlbaId)?.bteg_id ?? "";

  // ── New device + specs ──
  const [deviceType, setDeviceType] = useState<DeviceType>((r.device_type as DeviceType) ?? "desktop");
  const [purpose, setPurpose]       = useState(r.purpose ?? "");
  const [specs, setSpecs]           = useState(specsStateFromJsonb((r.specs as Record<string, any>) ?? {}));

  // ── Source device ──
  const [selectedDevice, setSelectedDevice] = useState<PickedDevice | null>(
    r.old_device
      ? {
          id: r.old_device.id,
          name: r.old_device.name,
          model: r.old_device.model,
          serial_number: r.old_device.serial_number,
          device_type: r.old_device.device_type,
          status: r.old_device.status,
          location: r.old_device.location,
          specs: r.old_device.specs ?? undefined,
          owners: (r.old_device.device_assignments ?? []).map((a: any) => ({
            id: a.user?.id,
            first_name: a.user?.first_name,
            last_name: a.user?.last_name,
            position_name: a.user?.position_name,
            is_primary: a.is_primary,
          })),
        }
      : null
  );

  // ── Transfer destination ──
  const [transferOld, setTransferOld]   = useState(r.transfer_old ?? false);
  const [trOrgId, setTrOrgId]           = useState(() => orgIdFromBteg(r.transfer_to_org_bteg ?? ""));
  const [trHeltesId, setTrHeltesId]     = useState(() => heltesIdFromBteg(r.transfer_to_heltes_bteg ?? ""));
  const [trAlbaId, setTrAlbaId]         = useState(() => albaIdFromBteg(r.transfer_to_alba_bteg ?? ""));
  const [trUser, setTrUser]             = useState<PickedUser | null>(null);
  const trOrgBteg    = orgStructure.organizations.find((o) => o.id === trOrgId)?.bteg_id ?? "";
  const trHeltesBteg = orgStructure.heltes.find((h) => h.id === trHeltesId)?.bteg_id ?? "";
  const trAlbaBteg   = orgStructure.alba.find((a) => a.id === trAlbaId)?.bteg_id ?? "";

  // ── Notes ──
  const [notes, setNotes] = useState(r.notes ?? "");

  // ── Status ──
  const [status, setStatus]         = useState<DeviceRequestStatus>(r.status ?? "pending");
  const [adminNotes, setAdminNotes] = useState(r.admin_notes ?? "");

  // ── Fulfillment linking (only for 'new' type) ──
  const [fulfilledById, setFulfilledById] = useState<string | null>(r.fulfilled_by_request_id ?? null);

  // ── Comments ──
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");

  // ── Type semantics ──
  const needsNewDevice    = requestType === "new" || requestType === "replace";
  const needsSourceDevice = requestType === "replace" || requestType === "transfer" || requestType === "decommission" || requestType === "repair";
  const needsTransferDest = requestType === "transfer" || (requestType === "replace" && transferOld);

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateDeviceRequest(requestId, {
          req_org_bteg:    reqOrgBteg    || undefined,
          req_heltes_bteg: reqHeltesBteg || undefined,
          req_alba_bteg:   reqAlbaBteg   || undefined,
          request_type: requestType,
          priority,
          device_type:  needsNewDevice ? deviceType : (selectedDevice?.device_type ?? undefined),
          specs:        needsNewDevice ? buildSpecsFromState(deviceType, specs) : {},
          purpose: purpose.trim() || undefined,
          notes:   notes.trim()   || undefined,
          old_device_id:           needsSourceDevice ? (selectedDevice?.id || undefined) : undefined,
          transfer_old:            requestType === "replace" ? transferOld : (requestType === "transfer"),
          transfer_to_org_bteg:    needsTransferDest ? (trOrgBteg    || undefined) : undefined,
          transfer_to_heltes_bteg: needsTransferDest ? (trHeltesBteg || undefined) : undefined,
          transfer_to_alba_bteg:   needsTransferDest ? (trAlbaBteg   || undefined) : undefined,
          transfer_to_user_id:     needsTransferDest ? (trUser?.id   || undefined) : undefined,
          status,
          admin_notes: adminNotes.trim() || undefined,
          created_by:  requester?.id ?? null,
          assigned_to: assignee?.id  ?? null,
          fulfilled_by_request_id: needsNewDevice ? fulfilledById : null,
        });
        toast.success("Хүсэлт шинэчлэгдлээ");
        router.push("/devices/requests");
      } catch (e: any) {
        toast.error(e.message ?? "Алдаа гарлаа");
      }
    });
  };

  const handlePostComment = () => {
    if (!newComment.trim()) return;
    startComment(async () => {
      try {
        await addDeviceRequestComment(requestId, newComment);
        setComments(c => [...c, {
          id: `tmp-${Date.now()}`,
          body: newComment.trim(),
          created_at: new Date().toISOString(),
          author: { name: "Та" },
        }]);
        setNewComment("");
        toast.success("Сэтгэгдэл нэмэгдлээ");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message ?? "Алдаа гарлаа");
      }
    });
  };

  const linkedTransfer = fulfilledById ? eligibleTransfers.find(t => t.id === fulfilledById) ?? r.fulfilled_by : null;

  const handleDelete = () => {
    startDelete(async () => {
      try {
        await deleteDeviceRequest(requestId);
        toast.success("Хүсэлт устгагдлаа");
        router.push("/devices/requests");
      } catch (e: any) {
        toast.error(e.message ?? "Алдаа гарлаа");
        setDeleteOpen(false);
      }
    });
  };

  const handleAssignToTarget = (targetId: string) => {
    startAssign(async () => {
      try {
        await assignTransferToRequest(requestId, targetId);
        toast.success("Хүсэлтэд оноосон");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message ?? "Алдаа гарлаа");
      }
    });
  };

  // ── Children split: monitor + transfer/decommission/repair ──
  const children: any[] = Array.isArray(r.children) ? r.children : [];
  const monitorChildren     = children.filter((c) => c.device_type === "monitor");
  const transferChildren    = children.filter((c) => c.request_type === "transfer");
  const decommissionChildren = children.filter((c) => c.request_type === "decommission");
  const repairChildren      = children.filter((c) => c.request_type === "repair");

  // Хуучин төхөөрөмж дээрх action-ууд mutually exclusive
  const hasOldDeviceActionChild =
    transferChildren.length > 0 ||
    decommissionChildren.length > 0 ||
    repairChildren.length > 0;

  // ── Дэлгэц нэмэх боломж: зөвхөн desktop + new/replace + child биш + monitor child аль хэдийн байхгүй ──
  const canAddMonitorToExisting =
    r.device_type === "desktop" &&
    (r.request_type === "new" || r.request_type === "replace") &&
    !r.parent_request_id &&
    monitorChildren.length === 0;

  // ── Хуучин төхөөрөмжийн action child нэмэх боломж (mutually exclusive) ──
  const canAddOldDeviceActionToExisting =
    r.request_type === "replace" &&
    !!r.old_device_id &&
    !r.parent_request_id &&
    !hasOldDeviceActionChild;

  const handleAddMonitor = () => {
    startAddMonitor(async () => {
      try {
        await createDeviceRequest({
          req_org_bteg:    r.req_org_bteg    ?? undefined,
          req_heltes_bteg: r.req_heltes_bteg ?? undefined,
          req_alba_bteg:   r.req_alba_bteg   ?? undefined,
          request_type:    r.request_type,
          priority:        (r.priority ?? "normal") as DeviceRequestPriority,
          device_type:     "monitor",
          specs:           buildSpecsFromState("monitor", newMonitorSpecs),
          purpose:         `Суурин компьютертэй хамт захиалсан${
            r.purpose ? `: ${r.purpose}` : ""
          }`,
          parent_request_id: requestId,
        });
        toast.success("Дэлгэцийн хүсэлт нэмэгдлээ");
        setShowAddMonitor(false);
        setNewMonitorSpecs(EMPTY_SPECS);
        router.refresh();
      } catch (e: any) {
        toast.error(e.message ?? "Алдаа гарлаа");
      }
    });
  };

  const handleAddOldDeviceActionChild = (
    action: "transfer" | "decommission" | "repair",
  ) => {
    startAddMonitor(async () => {
      try {
        const isTransfer = action === "transfer";
        await createDeviceRequest({
          req_org_bteg:    r.req_org_bteg    ?? undefined,
          req_heltes_bteg: r.req_heltes_bteg ?? undefined,
          req_alba_bteg:   r.req_alba_bteg   ?? undefined,
          request_type:    action,
          priority:        (r.priority ?? "normal") as DeviceRequestPriority,
          device_type:     r.old_device?.device_type ?? r.device_type,
          old_device_id:   r.old_device_id,
          transfer_old:    isTransfer,
          transfer_to_org_bteg:    isTransfer ? (r.transfer_to_org_bteg    ?? undefined) : undefined,
          transfer_to_heltes_bteg: isTransfer ? (r.transfer_to_heltes_bteg ?? undefined) : undefined,
          transfer_to_alba_bteg:   isTransfer ? (r.transfer_to_alba_bteg   ?? undefined) : undefined,
          transfer_to_user_id:     isTransfer ? (r.transfer_to_user_id     ?? undefined) : undefined,
          purpose: `Шинэчилсэн төхөөрөмжийг ${
            action === "transfer"
              ? "шилжүүлэх"
              : action === "decommission"
                ? "актлах"
                : "засварт явуулах"
          }${r.purpose ? `: ${r.purpose}` : ""}`,
          parent_request_id: requestId,
        });
        toast.success(
          action === "transfer"
            ? "Шилжүүлэх хүсэлт нэмэгдлээ"
            : action === "decommission"
              ? "Актлах хүсэлт нэмэгдлээ"
              : "Засварын хүсэлт нэмэгдлээ",
        );
        router.refresh();
      } catch (e: any) {
        toast.error(e.message ?? "Алдаа гарлаа");
      }
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* ── Main form column ── */}
      <div className="flex flex-col gap-5">

        {/* Type */}
        <Section title="Хүсэлтийн төрөл">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.entries(REQUEST_TYPE_CONFIG) as [DeviceRequestType, typeof REQUEST_TYPE_CONFIG[DeviceRequestType]][]).map(([key, cfg]) => (
              <button
                key={key} type="button"
                onClick={() => {
                  setRequestType(key);
                  if (key !== "replace") setTransferOld(false);
                  if (key !== "new" && key !== "replace") setFulfilledById(null);
                }}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                  requestType === key
                    ? cn("border-current", cfg.className)
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                <span className="text-sm font-semibold">{cfg.emoji} {cfg.label}</span>
                <span className={cn(
                  "text-xs",
                  requestType === key ? "opacity-80" : "text-muted-foreground",
                )}>{cfg.description}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Priority */}
        <Section title="Зэрэглэл">
          <div className="flex gap-2">
            {(Object.entries(PRIORITY_CONFIG) as [DeviceRequestPriority, typeof PRIORITY_CONFIG[DeviceRequestPriority]][]).map(([key, cfg]) => (
              <button
                key={key} type="button" onClick={() => setPriority(key)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  priority === key
                    ? cn("border-current", cfg.className)
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"
                )}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Requester profile */}
        <Section title="Хүсэлт гаргагч">
          <ProfilePicker selected={requester} onSelect={setRequester} search={searchProfiles} />
        </Section>

        {/* Requester dept */}
        <Section title="Хүсэлт гаргаж буй хэлтэс / алба">
          <OrgCascade
            orgStructure={orgStructure}
            orgId={reqOrgId} heltesId={reqHeltesId} albaId={reqAlbaId}
            onOrgChange={(v) => { setReqOrgId(v === NONE ? "" : v); setReqHeltesId(""); setReqAlbaId(""); }}
            onHeltesChange={(v) => { setReqHeltesId(v === NONE ? "" : v); setReqAlbaId(""); }}
            onAlbaChange={(v) => setReqAlbaId(v === NONE ? "" : v)}
          />
        </Section>

        {/* Source device */}
        {needsSourceDevice && (
          <Section title={
            requestType === "replace"      ? "Шинэчлэх төхөөрөмж" :
            requestType === "transfer"     ? "Шилжүүлэх төхөөрөмж" :
            requestType === "decommission" ? "Актлах төхөөрөмж"   :
                                             "Засварлах төхөөрөмж"
          }>
            <DevicePicker orgStructure={orgStructure} selected={selectedDevice} onSelect={setSelectedDevice} />
          </Section>
        )}

        {/* New device specs */}
        {needsNewDevice && (
          <Section title={requestType === "new" ? "Хүсч буй төхөөрөмж" : "Авах шинэ төхөөрөмж"}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel required>Төрөл</FieldLabel>
                <Select value={deviceType} onValueChange={(v) => setDeviceType(v as DeviceType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DeviceSpecsFields deviceType={deviceType} specs={specs} setSpecs={setSpecs} />

              <div className="sm:col-span-2">
                <FieldLabel required>Зориулалт / Үндэслэл</FieldLabel>
                <Textarea
                  value={purpose} onChange={(e) => setPurpose(e.target.value)}
                  rows={3} className="resize-none"
                />
              </div>
            </div>
          </Section>
        )}

        {/* Transfer destination */}
        {(requestType === "transfer" || (requestType === "replace" && selectedDevice)) && (
          <Section title={requestType === "transfer" ? "Шилжүүлэх хүлээн авагч" : "Хуучин төхөөрөмжийг шилжүүлэх"}>
            <div className="flex flex-col gap-4">
              {requestType === "replace" && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox" id="transfer" checked={transferOld}
                    onChange={(e) => {
                      setTransferOld(e.target.checked);
                      if (!e.target.checked) { setTrOrgId(""); setTrHeltesId(""); setTrAlbaId(""); setTrUser(null); }
                    }}
                    className="h-4 w-4"
                  />
                  <label htmlFor="transfer" className="text-sm font-medium">
                    Хуучин төхөөрөмжийг өөр хэлтэс / хүнд шилжүүлэх
                  </label>
                </div>
              )}

              {needsTransferDest && (
                <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Шилжүүлэх хэлтэс / алба</p>
                    <OrgCascade
                      orgStructure={orgStructure}
                      orgId={trOrgId} heltesId={trHeltesId} albaId={trAlbaId}
                      onOrgChange={(v) => { setTrOrgId(v === NONE ? "" : v); setTrHeltesId(""); setTrAlbaId(""); }}
                      onHeltesChange={(v) => { setTrHeltesId(v === NONE ? "" : v); setTrAlbaId(""); }}
                      onAlbaChange={(v) => setTrAlbaId(v === NONE ? "" : v)}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Шилжүүлэх хүн (заавал биш)</p>
                    <UserPicker selected={trUser} onSelect={setTrUser} />
                  </div>

                  {requestType === "replace" && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                      <Link2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-900">
                        {transferChildren.length > 0 ? (
                          <>
                            <p className="font-semibold">
                              Энэ хүсэлтийн шилжүүлэх хэсэг нь тусдаа хүсэлт болж аль хэдийн үүссэн
                            </p>
                            <p className="opacity-80 mt-0.5">
                              Доорх "Хамт үүссэн шилжүүлэх хүсэлт" хэсгээс шилжүүлэх
                              хүсэлтийг нээж тусад нь засна уу. Энд бичсэн утга нь
                              зөвхөн referенс.
                            </p>
                          </>
                        ) : canAddOldDeviceActionToExisting ? (
                          <>
                            <p className="font-semibold">
                              Хуучин төхөөрөмж дээр гүйцэтгэх үйлдэл нэмэх боломжтой
                            </p>
                            <p className="opacity-80 mt-0.5">
                              Доорх "Хуучин төхөөрөмжтэй юу хийх вэ?" хэсгээс
                              шилжүүлэх / актлах / засварт явуулах сонголтын аль
                              нэгийг сонгож тусдаа хүсэлт үүсгэнэ үү.
                            </p>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Fulfilled by transfer (new/replace requests) */}
        {needsNewDevice && (
          <Section title="Шилжүүлэх хүсэлтэй холбох" action={
            linkedTransfer && (
              <button
                type="button" onClick={() => setFulfilledById(null)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <Unlink className="h-3 w-3" /> Холбоог салгах
              </button>
            )
          }>
            {linkedTransfer ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">Шилжүүлэх хүсэлттэй холбогдсон</span>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{linkedTransfer.old_device?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {DEVICE_TYPE_CONFIG[linkedTransfer.device_type as DeviceType]?.label ?? linkedTransfer.device_type}
                    {linkedTransfer.old_device?.serial_number ? ` · ${linkedTransfer.old_device.serial_number}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Гаргагч: {linkedTransfer.creator?.name ?? "—"}
                  </p>
                </div>
              </div>
            ) : eligibleTransfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Тохирох төрлийн шилжүүлэх хүсэлт олдсонгүй. Шинээр төхөөрөмж худалдан авах болно.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  Дараах шилжүүлэх хүсэлтүүдээс сонгож шинэ худалдан авалт шаардахгүйгээр энэ хүсэлтийг хангаж болно:
                </p>
                <div className="flex flex-col gap-1.5">
                  {eligibleTransfers.map((t: any) => (
                    <button
                      key={t.id} type="button"
                      onClick={() => setFulfilledById(t.id)}
                      className="rounded-lg border border-border bg-card p-3 text-left hover:border-primary/30 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{t.old_device?.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {DEVICE_TYPE_CONFIG[t.device_type as DeviceType]?.label ?? t.device_type}
                            {t.old_device?.serial_number ? ` · ${t.old_device.serial_number}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground/80 mt-0.5">
                            Гаргагч: {t.creator?.name ?? "—"}
                          </p>
                        </div>
                        <Badge variant="outline" className={cn("text-xs whitespace-nowrap", STATUS_COLORS[t.status as DeviceRequestStatus])}>
                          {STATUS_LABELS[t.status as DeviceRequestStatus]}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Дэлгэц нэмэх (existing desktop request, child аль хэдийн байхгүй) */}
        {canAddMonitorToExisting && (
          <Section title="Хамт захиалсан дэлгэц">
            {!showAddMonitor ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/10 p-3">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Энэ суурин компьютертэй хамт захиалах дэлгэц одоохондоо
                    бүртгэгдээгүй
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddMonitor(true)}
                  disabled={addingMonitor}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Дэлгэц нэмэх
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DeviceSpecsFields
                    deviceType="monitor"
                    specs={newMonitorSpecs}
                    setSpecs={setNewMonitorSpecs}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Дэлгэц нь тусдаа хүсэлт болж <strong>хүлээгдэж буй</strong>{" "}
                  төлөвтэй үүснэ. Үндсэн хүсэлтийн дараагийн status өөрчлөлт
                  түүнд автоматаар хамаарна.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={handleAddMonitor}
                    disabled={addingMonitor}
                    size="sm"
                  >
                    {addingMonitor ? "Нэмэж байна..." : "Дэлгэц нэмэх"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddMonitor(false);
                      setNewMonitorSpecs(EMPTY_SPECS);
                    }}
                    disabled={addingMonitor}
                  >
                    Болих
                  </Button>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Хамт захиалсан дэлгэцийн хүсэлт (parent view) */}
        {monitorChildren.length > 0 && (
          <Section title="Хамт захиалсан дэлгэц">
            <div className="flex flex-col gap-2">
              {monitorChildren.map((child: any) => {
                const monSize = child.specs?.size_inch;
                const resolution = child.specs?.resolution;
                const panel = child.specs?.panel_type;
                const summary = [
                  monSize ? `${monSize}"` : null,
                  resolution || null,
                  panel || null,
                ].filter(Boolean).join(" · ") || "Үзүүлэлт оруулаагүй";
                return (
                  <div
                    key={child.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <Monitor className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Дэлгэц</p>
                      <p className="text-xs text-muted-foreground">{summary}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs whitespace-nowrap",
                        STATUS_COLORS[child.status as DeviceRequestStatus],
                      )}
                    >
                      {STATUS_LABELS[child.status as DeviceRequestStatus]}
                    </Badge>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/devices/requests/${child.id}/edit`}>
                        <Link2 className="h-3.5 w-3.5" />
                        Дэлгэцийн хүсэлт нээх
                      </Link>
                    </Button>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Энэ хүсэлтийн төлөвийг өөрчлөхөд дэлгэцийн хүсэлт мөн адил
                автоматаар өөрчлөгдөнө.
              </p>
            </div>
          </Section>
        )}

        {/* Хуучин төхөөрөмж дээрх action child үүсгэх (mutually exclusive 3 төрөл) */}
        {canAddOldDeviceActionToExisting && (
          <Section title="Хуучин төхөөрөмжтэй юу хийх вэ?">
            <p className="text-xs text-muted-foreground mb-3">
              Хуучин төхөөрөмж дээр гүйцэтгэх үйлдэл сонгож тусдаа хүсэлт нэмэх
              боломжтой. Зөвхөн нэг үйлдэл сонгож болно.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddOldDeviceActionChild("transfer")}
                disabled={addingMonitor}
                className="justify-start"
              >
                <Link2 className="h-3.5 w-3.5" />
                Шилжүүлэх хүсэлт нэмэх
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddOldDeviceActionChild("decommission")}
                disabled={addingMonitor}
                className="justify-start"
              >
                <Link2 className="h-3.5 w-3.5" />
                Актлах хүсэлт нэмэх
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddOldDeviceActionChild("repair")}
                disabled={addingMonitor}
                className="justify-start"
              >
                <Link2 className="h-3.5 w-3.5" />
                Засварын хүсэлт нэмэх
              </Button>
            </div>
          </Section>
        )}

        {/* Хамт үүссэн шилжүүлэх хүсэлт (parent view) */}
        {transferChildren.length > 0 && (
          <Section title="Хамт үүссэн шилжүүлэх хүсэлт">
            <div className="flex flex-col gap-2">
              {transferChildren.map((child: any) => {
                const orgName = orgStructure.organizations.find(
                  (o) => o.bteg_id === child.transfer_to_org_bteg,
                )?.name;
                const heltesName = orgStructure.heltes.find(
                  (h) => h.bteg_id === child.transfer_to_heltes_bteg,
                )?.name;
                const albaName = orgStructure.alba.find(
                  (a) => a.bteg_id === child.transfer_to_alba_bteg,
                )?.name;
                const dest =
                  [orgName, heltesName, albaName].filter(Boolean).join(" / ") ||
                  "Хүлээн авах нэгж тодорхойгүй";
                return (
                  <div
                    key={child.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <Link2 className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Шилжүүлэх</p>
                      <p className="text-xs text-muted-foreground truncate">{dest}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs whitespace-nowrap",
                        STATUS_COLORS[child.status as DeviceRequestStatus],
                      )}
                    >
                      {STATUS_LABELS[child.status as DeviceRequestStatus]}
                    </Badge>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/devices/requests/${child.id}/edit`}>
                        <Link2 className="h-3.5 w-3.5" />
                        Шилжүүлэх хүсэлт нээх
                      </Link>
                    </Button>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Энэ хүсэлтийн төлөвийг өөрчлөхөд шилжүүлэх хүсэлт мөн адил
                автоматаар өөрчлөгдөнө.
              </p>
            </div>
          </Section>
        )}

        {/* Хамт үүссэн актлах хүсэлт */}
        {decommissionChildren.length > 0 && (
          <Section title="Хамт үүссэн актлах хүсэлт">
            <div className="flex flex-col gap-2">
              {decommissionChildren.map((child: any) => (
                <div
                  key={child.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <Link2 className="h-4 w-4 text-rose-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Актлах</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {child.notes || "Шалтгаан тодорхойгүй"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs whitespace-nowrap",
                      STATUS_COLORS[child.status as DeviceRequestStatus],
                    )}
                  >
                    {STATUS_LABELS[child.status as DeviceRequestStatus]}
                  </Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/devices/requests/${child.id}/edit`}>
                      <Link2 className="h-3.5 w-3.5" />
                      Актлах хүсэлт нээх
                    </Link>
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Энэ хүсэлтийн төлөвийг өөрчлөхөд актлах хүсэлт мөн адил
                автоматаар өөрчлөгдөнө.
              </p>
            </div>
          </Section>
        )}

        {/* Хамт үүссэн засварын хүсэлт */}
        {repairChildren.length > 0 && (
          <Section title="Хамт үүссэн засварын хүсэлт">
            <div className="flex flex-col gap-2">
              {repairChildren.map((child: any) => (
                <div
                  key={child.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <Link2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Засвар</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {child.notes || "Эвдрэлийн тайлбар тодорхойгүй"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs whitespace-nowrap",
                      STATUS_COLORS[child.status as DeviceRequestStatus],
                    )}
                  >
                    {STATUS_LABELS[child.status as DeviceRequestStatus]}
                  </Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/devices/requests/${child.id}/edit`}>
                      <Link2 className="h-3.5 w-3.5" />
                      Засварын хүсэлт нээх
                    </Link>
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Энэ хүсэлтийн төлөвийг өөрчлөхөд засварын хүсэлт мөн адил
                автоматаар өөрчлөгдөнө.
              </p>
            </div>
          </Section>
        )}

        {/* Эх хүсэлт (child view) */}
        {r.parent && (
          <Section title="Эх хүсэлт">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <Link2 className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {DEVICE_TYPE_CONFIG[r.parent.device_type as DeviceType]?.label ??
                    r.parent.device_type ??
                    "Эх хүсэлт"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Энэ хүсэлт нь дээрх хүсэлттэй хамт автоматаар үүссэн.
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs whitespace-nowrap",
                  STATUS_COLORS[r.parent.status as DeviceRequestStatus],
                )}
              >
                {STATUS_LABELS[r.parent.status as DeviceRequestStatus]}
              </Badge>
              <Button asChild variant="outline" size="sm">
                <Link href={`/devices/requests/${r.parent.id}/edit`}>
                  <Link2 className="h-3.5 w-3.5" />
                  Эх хүсэлт нээх
                </Link>
              </Button>
            </div>
          </Section>
        )}

        {/* Transfer → target assignment (only for transfer type) */}
        {requestType === "transfer" && (
          <Section title="Энэ төхөөрөмжийг ямар хүсэлтэд оноох вэ?">
            {eligibleTargets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center">
                <Link2 className="mb-2 h-6 w-6 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Тохирох төрлийн хүлээгдэж буй шинэ / шинэчлэх хүсэлт байхгүй байна
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="text-xs text-muted-foreground">
                  Дараах <strong>{eligibleTargets.length}</strong> хүсэлт энэ
                  төхөөрөмжийг хүлээж авах боломжтой. Аль нэгийг сонгоход тэр
                  хүсэлт энэ шилжүүлэгтэй автоматаар холбогдоно.
                </p>
                {eligibleTargets.map((t: any) => {
                  const TypeIcon = getDeviceTypeIcon(t.device_type);
                  const typeLabel = DEVICE_TYPE_CONFIG[t.device_type as DeviceType]?.label ?? t.device_type ?? "—";
                  const reqOrgName    = orgStructure.organizations.find(o => o.bteg_id === t.req_org_bteg)?.name;
                  const reqHeltesName = orgStructure.heltes.find(h => h.bteg_id === t.req_heltes_bteg)?.name;
                  const reqAlbaName   = orgStructure.alba.find(a => a.bteg_id === t.req_alba_bteg)?.name;
                  const reqCfg = REQUEST_TYPE_CONFIG[t.request_type as DeviceRequestType];
                  const priCfg = PRIORITY_CONFIG[(t.priority ?? "normal") as DeviceRequestPriority];
                  const specChips = formatDeviceSpecs(t.device_type, t.specs);
                  const ageDays = Math.floor(
                    (Date.now() - new Date(t.created_at).getTime()) / 86_400_000,
                  );
                  return (
                    <div
                      key={t.id}
                      className="rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Device icon */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <TypeIcon className="h-4 w-4" />
                        </div>

                        {/* Main info */}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          {/* Top row: badges + age */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn("text-[11px] font-medium", reqCfg?.className)}
                            >
                              {reqCfg?.emoji} {reqCfg?.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn("text-[11px]", priCfg.className)}
                            >
                              {priCfg.label}
                            </Badge>
                            <span className={cn(
                              "ml-auto inline-flex items-center gap-1 text-[11px] tabular-nums",
                              ageDays > 7
                                ? "text-rose-600"
                                : ageDays > 3
                                  ? "text-amber-600"
                                  : "text-muted-foreground",
                            )}>
                              <Clock className="h-3 w-3" />
                              {ageDays === 0 ? "өнөөдөр" : `${ageDays} өдөр хүлээж буй`}
                            </span>
                          </div>

                          {/* Device type label */}
                          <p className="text-sm font-semibold truncate">{typeLabel}</p>

                          {/* Specs chips */}
                          {specChips.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {specChips.slice(0, 5).map((chip, i) => (
                                <span
                                  key={i}
                                  className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                                >
                                  {chip}
                                </span>
                              ))}
                              {specChips.length > 5 && (
                                <span className="text-[10px] text-muted-foreground self-center">
                                  +{specChips.length - 5}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Creator + dept + date */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <UserIcon className="h-3 w-3" />
                              <span className="font-medium text-foreground">{t.creator?.name ?? "—"}</span>
                            </span>
                            {(reqOrgName || reqHeltesName || reqAlbaName) && (
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {[reqOrgName, reqHeltesName, reqAlbaName].filter(Boolean).join(" / ")}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Calendar className="h-3 w-3" />
                              {formatDateTime(t.created_at)}
                            </span>
                          </div>

                          {/* Purpose */}
                          {t.purpose && (
                            <p className="rounded bg-muted/30 px-2 py-1 text-[11px] italic text-muted-foreground line-clamp-2">
                              «{t.purpose}»
                            </p>
                          )}
                        </div>

                        {/* Action */}
                        <Button
                          size="sm"
                          disabled={assigning}
                          onClick={() => handleAssignToTarget(t.id)}
                          className="shrink-0 gap-1.5"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Оноох
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* Assigned IT */}
        <Section title="Хариуцсан IT ажилтан">
          <ProfilePicker selected={assignee} onSelect={setAssignee} search={searchITStaff} placeholder="IT ажилтны нэрээр хайх..." />
        </Section>

        {/* Notes */}
        <Section title={
          requestType === "decommission" ? "Актлах шалтгаан"   :
          requestType === "repair"       ? "Эвдрэлийн тайлбар" :
                                           "Нэмэлт тэмдэглэл"
        }>
          <Textarea
            value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={3} className="resize-none"
          />
        </Section>

        {/* Status + admin notes */}
        <Section title="Хүсэлтийн төлөв">
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              {(["pending", "approved", "rejected"] as const).map((s) => (
                <button
                  key={s} type="button" onClick={() => setStatus(s)}
                  className={cn(
                    "flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    status === s
                      ? cn("border-current", STATUS_COLORS[s])
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <div>
              <FieldLabel>Админ тайлбар {status === "rejected" && <span className="text-destructive">*</span>}</FieldLabel>
              <Textarea
                value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={status === "rejected" ? "Татгалзсан шалтгаан..." : "Нэмэлт тэмдэглэл..."}
                rows={2} className="resize-none"
              />
            </div>
          </div>
        </Section>

        {/* Submit */}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Хадгалж байна..." : "Хадгалах"}
          </Button>
          <Button variant="outline" onClick={() => router.back()} disabled={pending}>Болих</Button>
          <Button
            variant="outline"
            className="ml-auto gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={pending || deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Устгах
          </Button>
        </div>
      </div>

      {/* ── Sidebar: comments + status history ── */}
      <div className="flex flex-col gap-5">
        {/* Comments */}
        <Section title={`Сэтгэгдэл (${comments.length})`}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Одоогоор сэтгэгдэл байхгүй</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{c.author?.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{c.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
              <Textarea
                value={newComment} onChange={(e) => setNewComment(e.target.value)}
                placeholder="Сэтгэгдэл бичих..."
                rows={2} className="resize-none text-sm"
              />
              <Button
                size="sm" onClick={handlePostComment}
                disabled={postingComment || !newComment.trim()}
                className="self-end gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {postingComment ? "Илгээж байна..." : "Илгээх"}
              </Button>
            </div>
          </div>
        </Section>

        {/* Delete confirmation */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Хүсэлт устгах уу?</AlertDialogTitle>
              <AlertDialogDescription>
                Энэ үйлдлийг буцаах боломжгүй. Сэтгэгдэл, төлөвийн түүх бүгд хамт устана.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Болих</AlertDialogCancel>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Устгаж байна..." : "Устгах"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Status history */}
        <Section title={`Төлөвийн түүх (${statusHistory.length})`}>
          {statusHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Түүх байхгүй</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {statusHistory.map((h) => (
                <div key={h.id} className="flex gap-2.5">
                  <Clock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {h.from_status && (
                        <>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", STATUS_COLORS[h.from_status as DeviceRequestStatus])}>
                            {STATUS_LABELS[h.from_status as DeviceRequestStatus] ?? h.from_status}
                          </Badge>
                          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                        </>
                      )}
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", STATUS_COLORS[h.to_status as DeviceRequestStatus])}>
                        {STATUS_LABELS[h.to_status as DeviceRequestStatus] ?? h.to_status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {h.changer?.name ?? "—"} · {formatDateTime(h.created_at)}
                    </p>
                    {h.note && <p className="text-xs italic mt-1">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
