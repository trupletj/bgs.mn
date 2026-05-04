"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { type OrgStructure, type DeviceType, DEVICE_TYPE_CONFIG } from "@/types/device";
import { getDevicesForRequest } from "@/actions/devices";
import type { UserSearchResult } from "@/actions/users";
import {
  Search, Package2, Plus, RefreshCw, X, User as UserIcon,
  Computer, Laptop, Monitor, Printer, Scan,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserSearchPicker } from "@/components/users/user-search-picker";

export const NONE = "__none__";

export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="text-xs font-medium text-muted-foreground mb-1">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </p>
  );
}

export function Section({ title, children, action }: { title: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border/60 px-5 py-3.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ─── Org cascade ────────────────────────────────────────────────────────────

export function OrgCascade({
  orgStructure, orgId, heltesId, albaId, onOrgChange, onHeltesChange, onAlbaChange,
}: {
  orgStructure: OrgStructure;
  orgId: string; heltesId: string; albaId: string;
  onOrgChange: (v: string) => void;
  onHeltesChange: (v: string) => void;
  onAlbaChange: (v: string) => void;
}) {
  const selectedOrgBteg = orgId
    ? (orgStructure.organizations.find((o) => o.id === orgId)?.bteg_id ?? null)
    : null;
  const selectedHeltesBteg = heltesId
    ? (orgStructure.heltes.find((h) => h.id === heltesId)?.bteg_id ?? null)
    : null;

  const filteredHeltes = useMemo(
    () => selectedOrgBteg ? orgStructure.heltes.filter((h) => h.org_bteg_id === selectedOrgBteg) : orgStructure.heltes,
    [selectedOrgBteg, orgStructure.heltes]
  );
  const filteredAlba = useMemo(() => {
    if (selectedHeltesBteg) return orgStructure.alba.filter((a) => a.heltes_bteg_id === selectedHeltesBteg);
    if (selectedOrgBteg)    return orgStructure.alba.filter((a) => a.org_bteg_id === selectedOrgBteg);
    return orgStructure.alba;
  }, [selectedHeltesBteg, selectedOrgBteg, orgStructure.alba]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <FieldLabel>Байгууллага</FieldLabel>
        <Select value={orgId || NONE} onValueChange={onOrgChange}>
          <SelectTrigger><SelectValue placeholder="Байгууллага сонгох" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— Сонгоогүй —</SelectItem>
            {orgStructure.organizations.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <FieldLabel>Хэлтэс</FieldLabel>
        <Select value={heltesId || NONE} onValueChange={onHeltesChange} disabled={filteredHeltes.length === 0}>
          <SelectTrigger><SelectValue placeholder="Хэлтэс сонгох" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— Сонгоогүй —</SelectItem>
            {filteredHeltes.map((h) => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <FieldLabel>Алба</FieldLabel>
        <Select value={albaId || NONE} onValueChange={onAlbaChange} disabled={filteredAlba.length === 0}>
          <SelectTrigger><SelectValue placeholder="Алба сонгох" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— Сонгоогүй —</SelectItem>
            {filteredAlba.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── Specs fields by device type ────────────────────────────────────────────

export interface SpecsState {
  cpu: string; ram: string; ssd: string; hdd: string; gpu: string; os: string;
  monSize: string; resolution: string; panelType: string;
  connection: string; colorCap: boolean;
}

export const EMPTY_SPECS: SpecsState = {
  cpu: "", ram: "", ssd: "", hdd: "", gpu: "", os: "",
  monSize: "", resolution: "", panelType: "",
  connection: "", colorCap: false,
};

export function specsStateFromJsonb(specs: Record<string, any>): SpecsState {
  return {
    cpu:        specs.cpu ?? "",
    ram:        specs.ram_gb?.toString() ?? "",
    ssd:        specs.ssd_gb?.toString() ?? "",
    hdd:        specs.hdd_gb?.toString() ?? "",
    gpu:        specs.gpu ?? "",
    os:         specs.os ?? "",
    monSize:    specs.size_inch?.toString() ?? "",
    resolution: specs.resolution ?? "",
    panelType:  specs.panel_type ?? "",
    connection: specs.connection ?? "",
    colorCap:   !!specs.color_capable,
  };
}

export function buildSpecsFromState(deviceType: DeviceType, s: SpecsState): Record<string, unknown> {
  if (deviceType === "desktop" || deviceType === "laptop")
    return { cpu: s.cpu, ram_gb: s.ram ? Number(s.ram) : undefined, ssd_gb: s.ssd ? Number(s.ssd) : undefined, hdd_gb: s.hdd ? Number(s.hdd) : undefined, gpu: s.gpu, os: s.os };
  if (deviceType === "monitor")
    return { size_inch: s.monSize ? Number(s.monSize) : undefined, resolution: s.resolution, panel_type: s.panelType };
  if (deviceType === "printer" || deviceType === "scanner")
    return { connection: s.connection, color_capable: s.colorCap };
  return {};
}

export function DeviceSpecsFields({
  deviceType, specs, setSpecs,
}: {
  deviceType: DeviceType;
  specs: SpecsState;
  setSpecs: React.Dispatch<React.SetStateAction<SpecsState>>;
}) {
  const u = (k: keyof SpecsState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSpecs((s) => ({ ...s, [k]: k === "colorCap" ? e.target.checked : e.target.value }));

  if (deviceType === "desktop" || deviceType === "laptop") return (
    <>
      <div><FieldLabel>CPU</FieldLabel><Input value={specs.cpu} onChange={u("cpu")} placeholder="Intel Core i7-1165G7" /></div>
      <div><FieldLabel>RAM (GB)</FieldLabel><Input type="number" value={specs.ram} onChange={u("ram")} placeholder="16" /></div>
      <div><FieldLabel>SSD (GB)</FieldLabel><Input type="number" value={specs.ssd} onChange={u("ssd")} placeholder="512" /></div>
      <div><FieldLabel>HDD (GB)</FieldLabel><Input type="number" value={specs.hdd} onChange={u("hdd")} placeholder="1000" /></div>
      <div><FieldLabel>GPU</FieldLabel><Input value={specs.gpu} onChange={u("gpu")} placeholder="NVIDIA RTX 3060" /></div>
      <div><FieldLabel>Үйлдлийн систем</FieldLabel><Input value={specs.os} onChange={u("os")} placeholder="Windows 11 Pro" /></div>
    </>
  );

  if (deviceType === "monitor") return (
    <>
      <div><FieldLabel>Хэмжээ (inch)</FieldLabel><Input type="number" value={specs.monSize} onChange={u("monSize")} placeholder="27" /></div>
      <div><FieldLabel>Нягтрал</FieldLabel><Input value={specs.resolution} onChange={u("resolution")} placeholder="1920x1080" /></div>
      <div><FieldLabel>Панелийн төрөл</FieldLabel><Input value={specs.panelType} onChange={u("panelType")} placeholder="IPS / TN / VA" /></div>
    </>
  );

  if (deviceType === "printer" || deviceType === "scanner") return (
    <>
      <div><FieldLabel>Холболтын төрөл</FieldLabel><Input value={specs.connection} onChange={u("connection")} placeholder="USB / Сүлжээ" /></div>
      <div className="flex items-center gap-3 mt-5">
        <input type="checkbox" id="color" checked={specs.colorCap} onChange={(e) => setSpecs((p) => ({ ...p, colorCap: e.target.checked }))} className="h-4 w-4" />
        <label htmlFor="color" className="text-sm font-medium">Өнгөт хэвлэлт</label>
      </div>
    </>
  );

  return null;
}

// ─── Device picker (search devices by org cascade) ──────────────────────────

export interface PickedDeviceOwner {
  id?: string;
  first_name?: string;
  last_name?: string;
  position_name?: string;
  is_primary?: boolean;
}

export interface PickedDevice {
  id: string;
  name: string;
  model?: string;
  serial_number?: string;
  device_type: string;
  status?: string;
  location?: string;
  specs?: Record<string, any>;
  owners?: PickedDeviceOwner[];
}

const DEVICE_STATUS_LABELS: Record<string, string> = {
  active:        "Идэвхтэй",
  in_repair:     "Засварт",
  in_storage:    "Агуулахад",
  decommissioned: "Актлагдсан",
};

const DEVICE_STATUS_COLORS: Record<string, string> = {
  active:        "bg-emerald-100 text-emerald-700",
  in_repair:     "bg-amber-100 text-amber-700",
  in_storage:    "bg-slate-100 text-slate-700",
  decommissioned: "bg-rose-100 text-rose-700",
};

function formatOwnerName(o: PickedDeviceOwner): string {
  return [o.last_name, o.first_name].filter(Boolean).join(" ") || "Нэргүй";
}

/**
 * Device type-аас тохирох lucide icon component-ыг буцаана
 */
export function getDeviceTypeIcon(deviceType?: string | null): React.ElementType {
  switch (deviceType) {
    case "desktop": return Computer;
    case "laptop":  return Laptop;
    case "monitor": return Monitor;
    case "printer": return Printer;
    case "scanner": return Scan;
    default:        return Package2;
  }
}

/**
 * Specs jsonb-аас compact label массив гаргана
 * жишээ: ["Intel i7", "16GB RAM", "512GB SSD"]
 */
export function formatDeviceSpecs(deviceType: string, specs?: Record<string, any> | null): string[] {
  if (!specs) return [];
  const out: string[] = [];
  if (deviceType === "desktop" || deviceType === "laptop") {
    if (specs.cpu)     out.push(String(specs.cpu));
    if (specs.ram_gb)  out.push(`${specs.ram_gb}GB RAM`);
    if (specs.ssd_gb)  out.push(`${specs.ssd_gb}GB SSD`);
    if (specs.hdd_gb)  out.push(`${specs.hdd_gb}GB HDD`);
    if (specs.gpu)     out.push(String(specs.gpu));
    if (specs.os)      out.push(String(specs.os));
  } else if (deviceType === "monitor") {
    if (specs.size_inch)  out.push(`${specs.size_inch}"`);
    if (specs.resolution) out.push(String(specs.resolution));
    if (specs.panel_type) out.push(String(specs.panel_type));
  } else if (deviceType === "printer" || deviceType === "scanner") {
    if (specs.connection)    out.push(String(specs.connection));
    if (specs.color_capable) out.push("Өнгөт");
  }
  return out;
}

/**
 * Spec field-уудыг icon + label + value pair-аар буцаана (detailed grid-д хэрэглэх)
 */
export interface SpecField { key: string; label: string; value: string }
export function buildSpecFields(deviceType: string, specs?: Record<string, any> | null): SpecField[] {
  if (!specs) return [];
  const fields: SpecField[] = [];
  const push = (key: string, label: string, val: any, suffix = "") => {
    if (val === undefined || val === null || val === "") return;
    fields.push({ key, label, value: `${val}${suffix}` });
  };
  if (deviceType === "desktop" || deviceType === "laptop") {
    push("cpu",    "CPU",   specs.cpu);
    push("ram",    "RAM",   specs.ram_gb, " GB");
    push("ssd",    "SSD",   specs.ssd_gb, " GB");
    push("hdd",    "HDD",   specs.hdd_gb, " GB");
    push("gpu",    "GPU",   specs.gpu);
    push("os",     "ҮС",    specs.os);
  } else if (deviceType === "monitor") {
    push("size",   "Хэмжээ",       specs.size_inch, '"');
    push("res",    "Нягтрал",      specs.resolution);
    push("panel",  "Панел",        specs.panel_type);
  } else if (deviceType === "printer" || deviceType === "scanner") {
    push("conn",   "Холболт",      specs.connection);
    push("color",  "Өнгө",         specs.color_capable ? "Өнгөт" : "Хар-цагаан");
  }
  return fields;
}

export function DevicePicker({
  orgStructure, selected, onSelect,
}: {
  orgStructure: OrgStructure;
  selected: PickedDevice | null;
  onSelect: (d: PickedDevice | null) => void;
}) {
  const [orgId, setOrgId] = useState("");
  const [heltesId, setHeltesId] = useState("");
  const [albaId, setAlbaId] = useState("");

  const orgBteg    = orgStructure.organizations.find((o) => o.id === orgId)?.bteg_id ?? "";
  const heltesBteg = orgStructure.heltes.find((h) => h.id === heltesId)?.bteg_id ?? "";
  const albaBteg   = orgStructure.alba.find((a) => a.id === albaId)?.bteg_id ?? "";

  const [list, setList] = useState<PickedDevice[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    const res = await getDevicesForRequest({
      org_bteg:    orgBteg    || undefined,
      heltes_bteg: heltesBteg || undefined,
      alba_bteg:   albaBteg   || undefined,
    });
    // Map server shape → PickedDevice
    const mapped: PickedDevice[] = (res as any[]).map((d) => ({
      id: d.id,
      name: d.name,
      model: d.model ?? undefined,
      serial_number: d.serial_number ?? undefined,
      device_type: d.device_type,
      status: d.status ?? undefined,
      location: d.location ?? undefined,
      specs: d.specs ?? undefined,
      owners: (d.device_assignments ?? []).map((a: any) => ({
        id: a.user?.id,
        first_name: a.user?.first_name,
        last_name: a.user?.last_name,
        position_name: a.user?.position_name,
        is_primary: a.is_primary,
      })),
    }));
    setList(mapped);
    setLoading(false);
  }, [orgBteg, heltesBteg, albaBteg]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  return (
    <div className="flex flex-col gap-4">
      {selected && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Сонгосон төхөөрөмж
          </p>
          <SelectedDeviceCard device={selected} onClear={() => onSelect(null)} />
        </div>
      )}

      <p className="text-xs text-muted-foreground">Байгууллага / хэлтэс / албаар шүүж төхөөрөмжөө сонгоно уу.</p>

      <OrgCascade
        orgStructure={orgStructure}
        orgId={orgId} heltesId={heltesId} albaId={albaId}
        onOrgChange={(v) => { setOrgId(v === NONE ? "" : v); setHeltesId(""); setAlbaId(""); onSelect(null); }}
        onHeltesChange={(v) => { setHeltesId(v === NONE ? "" : v); setAlbaId(""); onSelect(null); }}
        onAlbaChange={(v) => { setAlbaId(v === NONE ? "" : v); onSelect(null); }}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Төхөөрөмж сонгох
          {!loading && <span className="ml-1.5 text-muted-foreground/70">({list.length})</span>}
        </p>
        <button
          type="button" onClick={fetchDevices}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Шинэчлэх
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Уншиж байна...</div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center">
          <Package2 className="mb-2 h-6 w-6 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Төхөөрөмж олдсонгүй</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto rounded-lg border border-border p-1.5">
          {list.map((d) => (
            <DeviceListItem
              key={d.id}
              device={d}
              selected={selected?.id === d.id}
              onClick={() => onSelect(selected?.id === d.id ? null : d)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Device list item (compact preview) ────────────────────────────────────

function DeviceListItem({
  device,
  selected,
  onClick,
}: {
  device: PickedDevice;
  selected: boolean;
  onClick: () => void;
}) {
  const typeCfg = DEVICE_TYPE_CONFIG[device.device_type as DeviceType];
  const specChips = formatDeviceSpecs(device.device_type, device.specs);
  const owners = device.owners ?? [];
  const primary = owners.find((o) => o.is_primary) ?? owners[0];
  const otherOwnersCount = owners.length > 1 ? owners.length - 1 : 0;
  const statusLabel = device.status ? DEVICE_STATUS_LABELS[device.status] ?? device.status : null;
  const statusCls = device.status ? DEVICE_STATUS_COLORS[device.status] ?? "bg-slate-100 text-slate-700" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{device.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {typeCfg?.label}
            {device.model ? ` · ${device.model}` : ""}
            {device.serial_number ? ` · ${device.serial_number}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {statusLabel && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", statusCls)}>
              {statusLabel}
            </span>
          )}
          {selected && (
            <span className="text-[10px] font-semibold text-primary">✓ Сонгосон</span>
          )}
        </div>
      </div>

      {specChips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {specChips.slice(0, 4).map((chip, i) => (
            <span
              key={i}
              className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {chip}
            </span>
          ))}
          {specChips.length > 4 && (
            <span className="text-[10px] text-muted-foreground">
              +{specChips.length - 4}
            </span>
          )}
        </div>
      )}

      {primary && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <UserIcon className="h-3 w-3" />
          <span className="truncate">
            {formatOwnerName(primary)}
            {primary.position_name && (
              <span className="text-muted-foreground/70"> · {primary.position_name}</span>
            )}
          </span>
          {otherOwnersCount > 0 && (
            <span className="text-muted-foreground/70">+ {otherOwnersCount}</span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Selected device detail card ───────────────────────────────────────────

function SelectedDeviceCard({
  device,
  onClear,
}: {
  device: PickedDevice;
  onClear: () => void;
}) {
  const typeCfg = DEVICE_TYPE_CONFIG[device.device_type as DeviceType];
  const specFields = buildSpecFields(device.device_type, device.specs);
  const owners = device.owners ?? [];
  const statusLabel = device.status ? DEVICE_STATUS_LABELS[device.status] ?? device.status : null;
  const statusCls = device.status ? DEVICE_STATUS_COLORS[device.status] ?? "bg-slate-100 text-slate-700" : "";

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-primary/15 bg-primary/5 px-4 py-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <Package2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-primary truncate">{device.name}</p>
              {statusLabel && (
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", statusCls)}>
                  {statusLabel}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {typeCfg?.label}
              {device.model ? ` · ${device.model}` : ""}
              {device.serial_number && (
                <span className="font-mono"> · {device.serial_number}</span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Сонголтыг арилгах"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Specs grid */}
        {specFields.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Техникийн үзүүлэлт
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {specFields.map((f) => (
                <div
                  key={f.key}
                  className="rounded-md border border-border/60 bg-card px-2.5 py-1.5"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{f.label}</p>
                  <p className="text-xs font-medium truncate">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Owners */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Эзэмшигч ({owners.length})
          </p>
          {owners.length === 0 ? (
            <p className="text-xs text-muted-foreground">Бүртгэгдсэн эзэмшигч байхгүй</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {owners.map((o, i) => (
                <div
                  key={`${o.id ?? i}`}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs",
                    o.is_primary
                      ? "border-primary/30 bg-primary/8"
                      : "border-border bg-muted/40",
                  )}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    {(o.last_name?.[0] ?? o.first_name?.[0] ?? "?").toUpperCase()}
                  </div>
                  <span className="font-medium truncate max-w-[140px]">{formatOwnerName(o)}</span>
                  {o.position_name && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                      · {o.position_name}
                    </span>
                  )}
                  {o.is_primary && (
                    <span className="text-[9px] font-semibold text-primary uppercase">Үндсэн</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location */}
        {device.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium">Байршил:</span>
            <span>{device.location}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── User picker (single-select wrapper around UserSearchPicker) ────────────

export interface PickedUser {
  id: string;
  first_name: string;
  last_name: string;
  position_name?: string;
}

export function UserPicker({
  selected,
  onSelect,
  placeholder = "Нэр, овог, утас, албан тушаал...",
}: {
  selected: PickedUser | null;
  onSelect: (u: PickedUser | null) => void;
  placeholder?: string;
}) {
  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
        <span className="font-medium">
          {selected.last_name} {selected.first_name}
        </span>
        {selected.position_name && (
          <span className="text-xs text-muted-foreground">
            · {selected.position_name}
          </span>
        )}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="ml-auto text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <UserSearchPicker
      placeholder={placeholder}
      onSelect={(u: UserSearchResult) =>
        onSelect({
          id: u.id,
          first_name: u.first_name ?? "",
          last_name: u.last_name ?? "",
          position_name: u.position_name ?? undefined,
        })
      }
    />
  );
}

// ─── Profile picker (search profile table) ──────────────────────────────────
// UserSearchPicker-тэй ижил харагдалттай: avatar + meta + Skeleton + outside-click +
// Escape + stale-request safety + Plus icon + empty state.

export interface PickedProfile {
  id: number; name: string; department_name?: string; position_name?: string;
}

export function ProfilePicker({
  selected, onSelect, search,
  placeholder = "Нэрээр хайх...",
  disabled,
  limit = 12,
  autoFocus,
}: {
  selected: PickedProfile | null;
  onSelect: (p: PickedProfile | null) => void;
  search: (q: string) => Promise<PickedProfile[]>;
  placeholder?: string;
  disabled?: boolean;
  limit?: number;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const myReq = ++reqIdRef.current;
    const timer = setTimeout(async () => {
      const data = await search(trimmed);
      if (myReq !== reqIdRef.current) return;
      setResults(data.slice(0, limit));
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, search, limit]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleSelect = (p: PickedProfile) => {
    onSelect(p);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {selected.name?.[0] ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium">{selected.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[selected.position_name, selected.department_name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { onSelect(null); setQuery(""); }}
          className="text-muted-foreground hover:text-destructive"
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-9"
      />
      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {loading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-center text-xs text-muted-foreground">
              «{query.trim()}» хайлтад тохирох ажилтан олдсонгүй
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((p) => {
                const meta = [p.position_name, p.department_name]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(p)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {p.name?.[0] ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {p.name}
                        </p>
                        {meta && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {meta}
                          </p>
                        )}
                      </div>
                      <Plus className="h-4 w-4 shrink-0 text-primary opacity-60" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Request type config ────────────────────────────────────────────────────

export const REQUEST_TYPE_CONFIG = {
  new: {
    label: "Шинээр авах",
    emoji: "🆕",
    description: "Шинэ төхөөрөмж худалдан авах",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  replace: {
    label: "Хуучныг шинэчлэх",
    emoji: "🔄",
    description: "Хуучин төхөөрөмжийг шинэ төхөөрөмжөөр солих",
    className: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  transfer: {
    label: "Шилжүүлэх",
    emoji: "↔️",
    description: "Төхөөрөмжийг өөр хэлтэс / хүн рүү шилжүүлэх",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  decommission: {
    label: "Актлах",
    emoji: "🗑️",
    description: "Хуучирсан төхөөрөмжийг ашиглалтаас гаргах",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  repair: {
    label: "Засварт явуулах",
    emoji: "🛠️",
    description: "Эвдэрсэн төхөөрөмжийг засварт явуулах",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
} as const;

export const PRIORITY_CONFIG = {
  urgent: { label: "Яаралтай", className: "bg-red-50 text-red-700 border-red-200" },
  normal: { label: "Хэвийн",   className: "bg-blue-50 text-blue-700 border-blue-200" },
  low:    { label: "Бага",     className: "bg-slate-50 text-slate-700 border-slate-200" },
} as const;
