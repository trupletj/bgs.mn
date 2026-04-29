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

  // ── Old/source device (replace/transfer/decommission/repair) ──
  const [selectedDevice, setSelectedDevice] = useState<PickedDevice | null>(null);

  // ── Transfer destination (replace+transferOld OR transfer) ──
  const [transferOld, setTransferOld] = useState(false);
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

  const handleSubmit = () => {
    if (!reqOrgBteg) { toast.error("Байгуулга сонгоно уу"); return; }
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
        await createDeviceRequest(payload);
        toast.success("Хүсэлт амжилттай илгээгдлээ");
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
                if (key !== "replace") setTransferOld(false);
              }}
              className={cn(
                "flex flex-col gap-1 rounded-lg border-2 px-4 py-3 text-left transition-colors",
                requestType === key
                  ? "border-primary bg-primary/8"
                  : "border-border bg-card hover:border-primary/30"
              )}
            >
              <span className="text-sm font-semibold">{cfg.emoji} {cfg.label}</span>
              <span className="text-xs text-muted-foreground">{cfg.description}</span>
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

      {/* ── Transfer destination (transfer always; replace optional) ── */}
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
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Шилжүүлэх хүн {requestType === "replace" && <span className="font-normal">(заавал биш)</span>}
                  </p>
                  <UserPicker selected={trUser} onSelect={setTrUser} />
                </div>
              </div>
            )}
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
