"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createDeviceRequest, type DeviceRequestInput, type DeviceRequestType, type DeviceRequestPriority,
} from "@/actions/devices";
import { DEVICE_TYPE_CONFIG, type DeviceType, type OrgStructure } from "@/types/device";
import { cn } from "@/lib/utils";
import {
  NONE, FieldLabel, Section, OrgCascade,
  DeviceSpecsFields, EMPTY_SPECS, buildSpecsFromState,
  DevicePicker, type PickedDevice,
  UserPicker, type PickedUser,
  REQUEST_TYPE_CONFIG, PRIORITY_CONFIG,
} from "@/components/devices/request-shared";
import { Link2, Unlink, Sparkles } from "lucide-react";

const DEVICE_TYPES = Object.entries(DEVICE_TYPE_CONFIG) as [DeviceType, { label: string }][];

interface Props {
  orgStructure: OrgStructure;
  eligibleTransfers?: any[];
}

export function DeviceRequestForm({ orgStructure, eligibleTransfers = [] }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // ── Type + priority ──
  const [requestType, setRequestType] = useState<DeviceRequestType>("new");
  const [priority, setPriority] = useState<DeviceRequestPriority>("normal");

  // ── Requester dept ──
  const [reqOrgId, setReqOrgId]       = useState("");
  const [reqHeltesId, setReqHeltesId] = useState("");
  const [reqAlbaId, setReqAlbaId]     = useState("");
  const reqOrgBteg    = orgStructure.organizations.find((o) => o.id === reqOrgId)?.bteg_id ?? "";
  const reqHeltesBteg = orgStructure.heltes.find((h) => h.id === reqHeltesId)?.bteg_id ?? "";
  const reqAlbaBteg   = orgStructure.alba.find((a) => a.id === reqAlbaId)?.bteg_id ?? "";

  // ── Device + specs (new/replace) ──
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");
  const [purpose, setPurpose]       = useState("");
  const [specs, setSpecs]           = useState(EMPTY_SPECS);

  // ── Hamt orogno bui delgets (зөвхөн desktop + new/replace үед) ──
  const [addMonitor, setAddMonitor]       = useState(false);
  const [monitorSpecs, setMonitorSpecs]   = useState(EMPTY_SPECS);

  // ── Old/source device (replace/transfer/decommission/repair) ──
  const [selectedDevice, setSelectedDevice] = useState<PickedDevice | null>(null);

  // ── Хуучин төхөөрөмжтэй юу хийх вэ? (replace) ──
  type OldDeviceAction = "none" | "transfer" | "decommission" | "repair";
  const [oldDeviceAction, setOldDeviceAction] = useState<OldDeviceAction>("none");
  const [oldDeviceNotes, setOldDeviceNotes]   = useState("");
  const transferOld = oldDeviceAction === "transfer";

  // Transfer destination
  const [trOrgId, setTrOrgId]         = useState("");
  const [trHeltesId, setTrHeltesId]   = useState("");
  const [trAlbaId, setTrAlbaId]       = useState("");
  const [trUser, setTrUser]           = useState<PickedUser | null>(null);
  const trOrgBteg    = orgStructure.organizations.find((o) => o.id === trOrgId)?.bteg_id ?? "";
  const trHeltesBteg = orgStructure.heltes.find((h) => h.id === trHeltesId)?.bteg_id ?? "";
  const trAlbaBteg   = orgStructure.alba.find((a) => a.id === trAlbaId)?.bteg_id ?? "";

  // ── Notes ──
  const [notes, setNotes] = useState("");

  // ── Fulfilled by transfer (new/replace) ──
  const [fulfilledById, setFulfilledById] = useState<string | null>(null);
  const matchingTransfers = useMemo(
    () => eligibleTransfers.filter(t => t.device_type === deviceType),
    [eligibleTransfers, deviceType]
  );
  const linkedTransfer = fulfilledById ? matchingTransfers.find(t => t.id === fulfilledById) : null;

  // ── Type semantics ──
  const needsNewDevice    = requestType === "new" || requestType === "replace";
  const needsSourceDevice = requestType === "replace" || requestType === "transfer" || requestType === "decommission" || requestType === "repair";
  const needsTransferDest = requestType === "transfer" || (requestType === "replace" && transferOld);
  const canAddMonitor     = needsNewDevice && deviceType === "desktop";

  if (!canAddMonitor && addMonitor) {
    setAddMonitor(false);
    setMonitorSpecs(EMPTY_SPECS);
  }

  const handleSubmit = () => {
    if (!reqOrgBteg) { toast.error("Байгууллага сонгоно уу"); return; }
    if (needsNewDevice && !purpose.trim()) { toast.error("Зориулалт / үндэслэл оруулна уу"); return; }
    if (needsSourceDevice && !selectedDevice) {
      toast.error("Холбогдох төхөөрөмжийг сонгоно уу"); return;
    }
    if (requestType === "repair" && !notes.trim()) {
      toast.error("Эвдрэлийн тайлбар бичнэ үү"); return;
    }

    startTransition(async () => {
      try {
        const payload: DeviceRequestInput = {
          req_org_bteg:    reqOrgBteg    || undefined,
          req_heltes_bteg: reqHeltesBteg || undefined,
          req_alba_bteg:   reqAlbaBteg   || undefined,
          request_type: requestType,
          priority,
          device_type:  needsNewDevice ? deviceType : (selectedDevice?.device_type ?? undefined),
          specs:        needsNewDevice ? buildSpecsFromState(deviceType, specs) : {},
          purpose:      purpose.trim() || undefined,
          notes:        notes.trim()   || undefined,
          old_device_id:     selectedDevice?.id || undefined,
          transfer_old:      requestType === "replace" ? transferOld : (requestType === "transfer" ? true : false),
          transfer_to_org_bteg:    needsTransferDest ? (trOrgBteg    || undefined) : undefined,
          transfer_to_heltes_bteg: needsTransferDest ? (trHeltesBteg || undefined) : undefined,
          transfer_to_alba_bteg:   needsTransferDest ? (trAlbaBteg   || undefined) : undefined,
          transfer_to_user_id:     needsTransferDest ? (trUser?.id   || undefined) : undefined,
          fulfilled_by_request_id: needsNewDevice ? fulfilledById : null,
        };
        const parentId = await createDeviceRequest(payload);

        const created: string[] = [];
        const errored: string[] = [];

        if (addMonitor && canAddMonitor) {
          try {
            await createDeviceRequest({
              req_org_bteg:    reqOrgBteg    || undefined,
              req_heltes_bteg: reqHeltesBteg || undefined,
              req_alba_bteg:   reqAlbaBteg   || undefined,
              request_type:    requestType,
              priority,
              device_type:     "monitor",
              specs:           buildSpecsFromState("monitor", monitorSpecs),
              purpose:         `Суурин компьютертэй хамт захиалсан${
                purpose.trim() ? `: ${purpose.trim()}` : ""
              }`,
              parent_request_id: parentId,
            });
            created.push("дэлгэц");
          } catch (e: any) {
            errored.push(`дэлгэц (${e?.message ?? ""})`);
          }
        }

        // Replace + oldDeviceAction → child үүсгэх (transfer/decommission/repair)
        if (
          requestType === "replace" &&
          oldDeviceAction !== "none" &&
          selectedDevice
        ) {
          const actionLabel =
            oldDeviceAction === "transfer"
              ? "шилжүүлэх"
              : oldDeviceAction === "decommission"
                ? "актлах"
                : "засварын";
          try {
            await createDeviceRequest({
              req_org_bteg:    reqOrgBteg    || undefined,
              req_heltes_bteg: reqHeltesBteg || undefined,
              req_alba_bteg:   reqAlbaBteg   || undefined,
              request_type:    oldDeviceAction,
              priority,
              device_type:     selectedDevice.device_type,
              old_device_id:   selectedDevice.id,
              transfer_old:    oldDeviceAction === "transfer",
              transfer_to_org_bteg:
                oldDeviceAction === "transfer" ? (trOrgBteg    || undefined) : undefined,
              transfer_to_heltes_bteg:
                oldDeviceAction === "transfer" ? (trHeltesBteg || undefined) : undefined,
              transfer_to_alba_bteg:
                oldDeviceAction === "transfer" ? (trAlbaBteg   || undefined) : undefined,
              transfer_to_user_id:
                oldDeviceAction === "transfer" ? (trUser?.id   || undefined) : undefined,
              notes: oldDeviceNotes.trim() || undefined,
              purpose: `Шинэчилсэн төхөөрөмжийг ${
                oldDeviceAction === "transfer"
                  ? "шилжүүлэх"
                  : oldDeviceAction === "decommission"
                    ? "актлах"
                    : "засварт явуулах"
              }${purpose.trim() ? `: ${purpose.trim()}` : ""}`,
              parent_request_id: parentId,
            });
            created.push(actionLabel);
          } catch (e: any) {
            errored.push(`${actionLabel} (${e?.message ?? ""})`);
          }
        }

        if (errored.length === 0) {
          toast.success(
            created.length > 0
              ? `Хүсэлт + ${created.join(" + ")} хүсэлт үүслээ`
              : "Хүсэлт амжилттай илгээгдлээ",
          );
        } else {
          toast.warning(
            `Үндсэн хүсэлт үүссэн. Дараах child үүсгэхэд алдаа: ${errored.join("; ")}`,
          );
        }

        router.push("/devices/requests");
      } catch (e: any) {
        toast.error(e.message ?? "Алдаа гарлаа");
      }
    });
  };

  return (
    <div className="flex flex-col gap-5 max-w-3xl">

      {/* ── Request type selector ── */}
      <Section title="Хүсэлтийн төрөл">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(REQUEST_TYPE_CONFIG) as [DeviceRequestType, typeof REQUEST_TYPE_CONFIG[DeviceRequestType]][]).map(([key, cfg]) => (
            <button
              key={key} type="button"
              onClick={() => {
                setRequestType(key);
                setSelectedDevice(null);
                if (key !== "replace") {
                  setOldDeviceAction("none");
                  setOldDeviceNotes("");
                  setTrOrgId(""); setTrHeltesId(""); setTrAlbaId(""); setTrUser(null);
                }
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

      {/* ── Priority ── */}
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

      {/* ── Requester dept ── */}
      <Section title="Хүсэлт гаргаж буй хэлтэс / алба">
        <OrgCascade
          orgStructure={orgStructure}
          orgId={reqOrgId} heltesId={reqHeltesId} albaId={reqAlbaId}
          onOrgChange={(v) => { setReqOrgId(v === NONE ? "" : v); setReqHeltesId(""); setReqAlbaId(""); }}
          onHeltesChange={(v) => { setReqHeltesId(v === NONE ? "" : v); setReqAlbaId(""); }}
          onAlbaChange={(v) => setReqAlbaId(v === NONE ? "" : v)}
        />
      </Section>

      {/* ── Source/old device (replace/transfer/decommission/repair) ── */}
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

      {/* ── New device specs (new/replace) ── */}
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
                placeholder="Яагаад энэ төхөөрөмж шаардлагатай байгааг тайлбарлана уу..."
                rows={3} className="resize-none"
              />
            </div>
          </div>
        </Section>
      )}

      {/* ── Hamt дэлгэц захиалах (зөвхөн desktop + new/replace) ── */}
      {canAddMonitor && (
        <Section title="Дэлгэц мөн захиалах">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={addMonitor}
              onChange={(e) => setAddMonitor(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">
              Энэ суурин компьютертэй хамт дэлгэц захиалах
            </span>
          </label>
          {addMonitor && (
            <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-border/60 bg-muted/20 p-4 sm:grid-cols-2">
              <DeviceSpecsFields
                deviceType="monitor"
                specs={monitorSpecs}
                setSpecs={setMonitorSpecs}
              />
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Дэлгэц нь тусдаа хүсэлт болж үүснэ. Суурин компьютерийн хүсэлтийг
                зөвшөөрөх / татгалзахад хамт нь автоматаар үйлчилнэ.
              </p>
            </div>
          )}
        </Section>
      )}

      {/* ── Pick eligible transfer (new/replace) ── */}
      {needsNewDevice && matchingTransfers.length > 0 && (
        <Section
          title={
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Шилжүүлэх боломжит төхөөрөмж
            </span>
          }
          action={
            linkedTransfer && (
              <button
                type="button" onClick={() => setFulfilledById(null)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <Unlink className="h-3 w-3" /> Холбоог салгах
              </button>
            )
          }
        >
          <p className="text-xs text-muted-foreground mb-3">
            Дараах төхөөрөмжүүд аль нэг хэлтсээс шилжүүлэхээр хүсэлт гаргасан байна. Шинээр худалдан авахын оронд эдгээрээс сонгож болно.
          </p>
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
                <p className="text-xs text-muted-foreground mt-1">Гаргагч: {linkedTransfer.creator?.name ?? "—"}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {matchingTransfers.map((t: any) => (
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
                      <p className="text-xs text-muted-foreground/80 mt-0.5">Гаргагч: {t.creator?.name ?? "—"}</p>
                    </div>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {t.status === "approved" ? "Зөвшөөрөгдсөн" : "Хүлээгдэж буй"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Хуучин төхөөрөмжтэй юу хийх вэ? (replace + selectedDevice) ── */}
      {requestType === "replace" && selectedDevice && (
        <Section title="Хуучин төхөөрөмжтэй юу хийх вэ?">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([
                { key: "none",         emoji: "—",  label: "Юу ч хийхгүй", desc: "Хуучин төхөөрөмж байсан газартаа үлдэнэ" },
                { key: "transfer",     emoji: "↗",  label: "Шилжүүлэх",    desc: "Өөр хэлтэс / хүнд шилжүүлэх" },
                { key: "decommission", emoji: "🗑", label: "Актлах",        desc: "Үйлчилгээнээс гаргах" },
                { key: "repair",       emoji: "🔧", label: "Засварт",       desc: "Засварт явуулах" },
              ] as const).map((a) => (
                <button
                  key={a.key} type="button"
                  onClick={() => {
                    setOldDeviceAction(a.key);
                    if (a.key !== "transfer") {
                      setTrOrgId(""); setTrHeltesId(""); setTrAlbaId(""); setTrUser(null);
                    }
                    if (a.key !== "decommission" && a.key !== "repair") {
                      setOldDeviceNotes("");
                    }
                  }}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                    oldDeviceAction === a.key
                      ? "border-primary bg-primary/8"
                      : "border-border bg-card hover:border-primary/30",
                  )}
                >
                  <span className="text-sm font-semibold">
                    {a.emoji} {a.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{a.desc}</span>
                </button>
              ))}
            </div>

            {oldDeviceAction === "transfer" && (
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
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Шилжүүлэх хүн <span className="font-normal">(заавал биш)</span>
                  </p>
                  <UserPicker selected={trUser} onSelect={setTrUser} />
                </div>
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <Link2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900">
                    <p className="font-semibold">Шинэ <strong>шилжүүлэх</strong> хүсэлт автоматаар үүснэ</p>
                    <p className="opacity-80 mt-0.5">
                      {trOrgBteg
                        ? "Хуучин төхөөрөмжийг сонгосон газарт шилжүүлэх тусдаа хүсэлт үүснэ."
                        : "Хүлээн авах нэгжийг одоохондоо тодорхойлоогүй ч шилжүүлэх хүсэлт үүснэ. Дараа нь түүнийг тохирох хэлтэс / хүнтэй холбож болно."}{" "}
                      Үндсэн хүсэлтийн зөвшөөрлийн төлөв түүнд автоматаар хамаарна.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(oldDeviceAction === "decommission" || oldDeviceAction === "repair") && (
              <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {oldDeviceAction === "decommission" ? "Актлах шалтгаан" : "Эвдрэлийн тайлбар"}{" "}
                    <span className="font-normal">(заавал биш)</span>
                  </p>
                  <Textarea
                    value={oldDeviceNotes}
                    onChange={(e) => setOldDeviceNotes(e.target.value)}
                    placeholder={
                      oldDeviceAction === "decommission"
                        ? "Яагаад актлах гэж байгааг тайлбарлана уу..."
                        : "Ямар асуудал гарсан, ямар эвдрэлтэй байгаа..."
                    }
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <Link2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900">
                    <p className="font-semibold">
                      Шинэ <strong>{oldDeviceAction === "decommission" ? "актлах" : "засварын"}</strong> хүсэлт автоматаар үүснэ
                    </p>
                    <p className="opacity-80 mt-0.5">
                      Энэ нь шинэчлэх хүсэлтэд холбогдоно. Үндсэн хүсэлтийн
                      зөвшөөрлийн төлөв түүнд автоматаар хамаарна.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Transfer destination (transfer request type only) ── */}
      {requestType === "transfer" && (
        <Section title="Шилжүүлэх хүлээн авагч">
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
              <p className="text-xs font-semibold text-muted-foreground mb-2">Шилжүүлэх хүн</p>
              <UserPicker selected={trUser} onSelect={setTrUser} />
            </div>
          </div>
        </Section>
      )}

      {/* ── Notes (decommission reason / repair problem / extra notes) ── */}
      <Section title={
        requestType === "decommission" ? "Актлах шалтгаан"        :
        requestType === "repair"       ? "Эвдрэлийн тайлбар"      :
                                         "Нэмэлт тэмдэглэл"
      }>
        <Textarea
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder={
            requestType === "decommission" ? "Яагаад актлах гэж байгааг тайлбарлана уу..." :
            requestType === "repair"       ? "Ямар асуудал гарсан, ямар эвдрэлтэй байгаа..." :
                                             "Нэмэлт мэдээлэл, тайлбар..."
          }
          rows={3} className="resize-none"
        />
      </Section>

      {/* ── Submit ── */}
      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Илгээж байна..." : "Хүсэлт илгээх"}
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={pending}>Болих</Button>
      </div>
    </div>
  );
}
