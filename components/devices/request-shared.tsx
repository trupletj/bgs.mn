"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type OrgStructure, type DeviceType, DEVICE_TYPE_CONFIG } from "@/types/device";
import { getDevicesForRequest, searchAssignableUsers } from "@/actions/devices";
import { Search, Package2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
        <FieldLabel>Байгуулга</FieldLabel>
        <Select value={orgId || NONE} onValueChange={onOrgChange}>
          <SelectTrigger><SelectValue placeholder="Байгуулга сонгох" /></SelectTrigger>
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

export interface PickedDevice {
  id: string; name: string; model?: string; serial_number?: string; device_type: string;
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
    setList(res as PickedDevice[]);
    setLoading(false);
  }, [orgBteg, heltesBteg, albaBteg]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">Байгуулга / хэлтэс / албаар шүүж төхөөрөмжөө сонгоно уу.</p>

      <OrgCascade
        orgStructure={orgStructure}
        orgId={orgId} heltesId={heltesId} albaId={albaId}
        onOrgChange={(v) => { setOrgId(v === NONE ? "" : v); setHeltesId(""); setAlbaId(""); onSelect(null); }}
        onHeltesChange={(v) => { setHeltesId(v === NONE ? "" : v); setAlbaId(""); onSelect(null); }}
        onAlbaChange={(v) => { setAlbaId(v === NONE ? "" : v); onSelect(null); }}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Төхөөрөмж сонгох</p>
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
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto rounded-lg border border-border">
          {list.map((d) => (
            <button
              key={d.id} type="button"
              onClick={() => onSelect(selected?.id === d.id ? null : d)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                selected?.id === d.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {DEVICE_TYPE_CONFIG[d.device_type as DeviceType]?.label}
                  {d.model ? ` · ${d.model}` : ""}
                  {d.serial_number ? ` · ${d.serial_number}` : ""}
                </p>
              </div>
              {selected?.id === d.id && (
                <span className="text-xs font-semibold text-primary shrink-0">Сонгогдсон</span>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <Package2 className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-primary">{selected.name}</span>
          {selected.serial_number && (
            <span className="text-xs text-muted-foreground font-mono">({selected.serial_number})</span>
          )}
          <button type="button" onClick={() => onSelect(null)} className="ml-auto text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── User picker (search users from `users` table) ──────────────────────────

export interface PickedUser {
  id: string; first_name: string; last_name: string; position_name?: string;
}

export function UserPicker({
  selected, onSelect, placeholder = "Нэрээр хайх...",
}: {
  selected: PickedUser | null;
  onSelect: (u: PickedUser | null) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PickedUser[]>([]);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await searchAssignableUsers(search);
      setResults(res);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  if (selected) return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
      <span className="font-medium">{selected.last_name} {selected.first_name}</span>
      {selected.position_name && <span className="text-xs text-muted-foreground">· {selected.position_name}</span>}
      <button type="button" onClick={() => { onSelect(null); setSearch(""); }} className="ml-auto text-muted-foreground hover:text-destructive">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} className="pl-9" />
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-md max-h-64 overflow-y-auto">
          {results.map((u) => (
            <button
              key={u.id} type="button"
              onClick={() => { onSelect(u); setSearch(""); setResults([]); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {(u.last_name?.[0] ?? "") + (u.first_name?.[0] ?? "")}
              </div>
              <div>
                <p className="font-medium">{u.last_name} {u.first_name}</p>
                <p className="text-xs text-muted-foreground">{u.position_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Profile picker (search profile table) ──────────────────────────────────

export interface PickedProfile {
  id: number; name: string; department_name?: string; position_name?: string;
}

export function ProfilePicker({
  selected, onSelect, search,
  placeholder = "Нэрээр хайх...",
}: {
  selected: PickedProfile | null;
  onSelect: (p: PickedProfile | null) => void;
  search: (q: string) => Promise<PickedProfile[]>;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedProfile[]>([]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => setResults(await search(query)), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  if (selected) return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {selected.name?.[0] ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{selected.name}</p>
        <p className="text-xs text-muted-foreground">
          {[selected.department_name, selected.position_name].filter(Boolean).join(" · ")}
        </p>
      </div>
      <button type="button" onClick={() => { onSelect(null); setQuery(""); }} className="text-muted-foreground hover:text-destructive">
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="pl-9" />
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-md max-h-64 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id} type="button"
              onClick={() => { onSelect(p); setQuery(""); setResults([]); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {p.name?.[0] ?? "?"}
              </div>
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[p.department_name, p.position_name].filter(Boolean).join(" · ")}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Request type config ────────────────────────────────────────────────────

export const REQUEST_TYPE_CONFIG = {
  new:          { label: "Шинээр авах",        emoji: "🆕", description: "Шинэ төхөөрөмж худалдан авах" },
  replace:      { label: "Хуучныг шинэчлэх",   emoji: "🔄", description: "Хуучин төхөөрөмжийг шинэ төхөөрөмжөөр солих" },
  transfer:     { label: "Шилжүүлэх",          emoji: "↔️", description: "Төхөөрөмжийг өөр хэлтэс / хүн рүү шилжүүлэх" },
  decommission: { label: "Актлах",             emoji: "🗑️", description: "Хуучирсан төхөөрөмжийг ашиглалтаас гаргах" },
  repair:       { label: "Засварт явуулах",    emoji: "🛠️", description: "Эвдэрсэн төхөөрөмжийг засварт явуулах" },
} as const;

export const PRIORITY_CONFIG = {
  urgent: { label: "Яаралтай", className: "bg-red-50 text-red-700 border-red-200" },
  normal: { label: "Хэвийн",   className: "bg-blue-50 text-blue-700 border-blue-200" },
  low:    { label: "Бага",     className: "bg-slate-50 text-slate-700 border-slate-200" },
} as const;
