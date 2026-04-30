"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createDevice, updateDevice, searchAssignableUsers,
  searchDevicesForPairing, setMonitorPairings, createPairedMonitors,
} from "@/actions/devices";
import {
  DEVICE_TYPE_CONFIG,
  type DeviceType, type DeviceStatus, type Device, type OrgStructure,
} from "@/types/device";
import { Search, X, Monitor as MonitorIcon, Laptop2, Plus, Sparkles } from "lucide-react";

const DEVICE_TYPES = Object.entries(DEVICE_TYPE_CONFIG) as [DeviceType, { label: string; group: string }][];
const NONE = "__none__";

interface UserOption { id: string; first_name: string; last_name: string; position_name?: string; department_name?: string; }

interface Props {
  mode: "create" | "edit";
  device?: Device;
  orgStructure: OrgStructure;
}

export function DeviceForm({ mode, device, orgStructure }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // ── Үндсэн мэдээлэл ──
  const [name, setName]         = useState(device?.name ?? "");
  const [model, setModel]       = useState(device?.model ?? "");
  const [serial, setSerial]     = useState(device?.serial_number ?? "");
  const [mfr, setMfr]           = useState(device?.manufacturer ?? "");
  const [type, setType]         = useState<DeviceType>(device?.device_type ?? "desktop");
  const status: DeviceStatus = "active";
  const [location, setLocation] = useState(device?.location ?? "");
  const [purchaseDate, setPD]   = useState(device?.purchase_date ?? "");
  const [warrantyDate, setWD]   = useState(device?.warranty_expiry_date ?? "");
  const [notes, setNotes]       = useState(device?.notes ?? "");

  // ── Байгуулллагын бүтэц ──
  const [orgId, setOrgId]         = useState(device?.organization_id ?? "");
  const [heltesId, setHeltesId]   = useState(device?.heltes_id ?? "");
  const [albaId, setAlbaId]       = useState(device?.alba_id ?? "");

  // Cascading filter
  const selectedOrgBtegId = orgId
    ? (orgStructure.organizations.find((o) => o.id === orgId)?.bteg_id ?? null)
    : null;
  const selectedHeltesBtegId = heltesId
    ? (orgStructure.heltes.find((h) => h.id === heltesId)?.bteg_id ?? null)
    : null;

  const filteredHeltes = useMemo(
    () => selectedOrgBtegId
      ? orgStructure.heltes.filter(h => h.org_bteg_id === selectedOrgBtegId)
      : orgStructure.heltes,
    [selectedOrgBtegId, orgStructure.heltes]
  );
  const filteredAlba = useMemo(() => {
    if (selectedHeltesBtegId) return orgStructure.alba.filter(a => a.heltes_bteg_id === selectedHeltesBtegId);
    if (selectedOrgBtegId)    return orgStructure.alba.filter(a => a.org_bteg_id === selectedOrgBtegId);
    return orgStructure.alba;
  }, [selectedHeltesBtegId, selectedOrgBtegId, orgStructure.alba]);

  const handleOrgChange = (v: string) => {
    setOrgId(v === NONE ? "" : v);
    setHeltesId("");
    setAlbaId("");
  };
  const handleHeltesChange = (v: string) => {
    setHeltesId(v === NONE ? "" : v);
    setAlbaId("");
  };
  const handleAlbaChange = (v: string) => {
    setAlbaId(v === NONE ? "" : v);
  };

  // ── Техникийн үзүүлэлт ──
  const specs = (device?.specs ?? {}) as Record<string, any>;
  const [cpu, setCpu]         = useState(specs.cpu ?? "");
  const [ram, setRam]         = useState(specs.ram_gb ?? "");
  const [ssd, setSsd]         = useState(specs.ssd_gb ?? "");
  const [hdd, setHdd]         = useState(specs.hdd_gb ?? "");
  const [gpu, setGpu]         = useState(specs.gpu ?? "");
  const [os, setOs]           = useState(specs.os ?? "");
  const [monSize, setMonSize] = useState(specs.size_inch ?? "");
  const [resolution, setRes]  = useState(specs.resolution ?? "");
  const [panelType, setPanel] = useState(specs.panel_type ?? "");
  const [connection, setConn] = useState(specs.connection ?? "");
  const [colorCapable, setClr]= useState<boolean>(specs.color_capable ?? false);

  // ── Pairing ──
  type PairDevice = { id: string; name: string; model?: string; serial_number?: string; device_type: string; paired_with_device_id?: string | null };

  // For monitor → pick one computer
  const initialPairedComputer: PairDevice | null = device?.paired_with
    ? { id: device.paired_with.id, name: device.paired_with.name, model: device.paired_with.model, serial_number: device.paired_with.serial_number, device_type: device.paired_with.device_type }
    : null;
  const [pairedComputer, setPairedComputer] = useState<PairDevice | null>(initialPairedComputer);
  const [computerSearch, setComputerSearch] = useState("");
  const [computerResults, setComputerResults] = useState<PairDevice[]>([]);

  useEffect(() => {
    if (type !== "monitor") return;
    if (!computerSearch.trim()) { setComputerResults([]); return; }
    const t = setTimeout(async () => {
      const res = await searchDevicesForPairing({ query: computerSearch, types: ["desktop", "laptop"], excludeId: device?.id });
      setComputerResults(res);
    }, 250);
    return () => clearTimeout(t);
  }, [computerSearch, type, device?.id]);

  // For computer → multi-pick monitors
  const initialPairedMonitors: PairDevice[] = (device?.paired_monitors ?? []) as PairDevice[];
  const [pairedMonitors, setPairedMonitors] = useState<PairDevice[]>(initialPairedMonitors);
  const [monitorSearch, setMonitorSearch] = useState("");
  const [monitorResults, setMonitorResults] = useState<PairDevice[]>([]);

  // Inline new-monitor entries (created on submit)
  type NewMonitor = { localId: string; name: string; model: string; serial_number: string; manufacturer: string; size_inch: string };
  const blankNewMonitor = (): NewMonitor => ({
    localId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "", model: "", serial_number: "", manufacturer: "", size_inch: "",
  });
  const [newMonitors, setNewMonitors] = useState<NewMonitor[]>([]);
  const [draftMonitor, setDraftMonitor] = useState<NewMonitor>(blankNewMonitor());
  const [draftOpen, setDraftOpen] = useState(false);

  const addDraftMonitor = () => {
    if (!draftMonitor.name.trim()) {
      toast.error("Дэлгэцийн нэр оруулна уу");
      return;
    }
    setNewMonitors(p => [...p, draftMonitor]);
    setDraftMonitor(blankNewMonitor());
    setDraftOpen(false);
  };
  const removeNewMonitor = (localId: string) =>
    setNewMonitors(p => p.filter(m => m.localId !== localId));

  useEffect(() => {
    if (type !== "desktop" && type !== "laptop") return;
    if (!monitorSearch.trim()) { setMonitorResults([]); return; }
    const t = setTimeout(async () => {
      const res = await searchDevicesForPairing({ query: monitorSearch, types: ["monitor"], excludeId: device?.id });
      // Hide already-selected monitors
      const selectedIds = new Set(pairedMonitors.map(m => m.id));
      const filtered = res.filter(m => !selectedIds.has(m.id));
      setMonitorResults(filtered);
    }, 250);
    return () => clearTimeout(t);
  }, [monitorSearch, type, device?.id, pairedMonitors]);

  // ── Хариуцагчид ──
  const existingUsers = device?.device_assignments?.map((a) => a.user).filter(Boolean) as UserOption[] ?? [];
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>(existingUsers);
  const [userSearch, setUserSearch]       = useState("");
  const [userResults, setUserResults]     = useState<UserOption[]>([]);

  useEffect(() => {
    if (!userSearch.trim()) { setUserResults([]); return; }
    const timer = setTimeout(async () => {
      const results = await searchAssignableUsers(userSearch);
      setUserResults(results);
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const addUser = (u: UserOption) => {
    if (selectedUsers.find((s) => s.id === u.id)) return;
    setSelectedUsers((p) => [...p, u]);
    setUserSearch("");
    setUserResults([]);
  };
  const removeUser = (id: string) => setSelectedUsers((p) => p.filter((u) => u.id !== id));

  const buildSpecs = (): Record<string, any> => {
    if (type === "desktop" || type === "laptop")
      return { cpu, ram_gb: ram ? Number(ram) : undefined, ssd_gb: ssd ? Number(ssd) : undefined, hdd_gb: hdd ? Number(hdd) : undefined, gpu, os };
    if (type === "monitor")
      return { size_inch: monSize ? Number(monSize) : undefined, resolution, panel_type: panelType };
    if (type === "printer" || type === "scanner")
      return { connection, color_capable: colorCapable };
    return {};
  };

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Нэр оруулна уу"); return; }

    // Derive text names from selected FK for backward compat
    const albaName   = orgStructure.alba.find(a => a.id === albaId)?.name;
    const heltesName = orgStructure.heltes.find(h => h.id === heltesId)?.name;

    startTransition(async () => {
      try {
        const base = {
          name: name.trim(),
          model: model || undefined,
          serial_number: serial || undefined,
          manufacturer: mfr || undefined,
          device_type: type,
          status,
          location: location || undefined,
          purchase_date: purchaseDate || undefined,
          warranty_expiry_date: warrantyDate || undefined,
          notes: notes || undefined,
          specs: buildSpecs(),
          organization_id: orgId || undefined,
          heltes_id: heltesId || undefined,
          alba_id: albaId || undefined,
          department_name: albaName || undefined,
          heltes_name: heltesName || undefined,
        };
        const pairedWithId = type === "monitor" ? (pairedComputer?.id ?? null) : null;

        const newMonitorPayload = newMonitors.map(m => ({
          name: m.name,
          model: m.model || undefined,
          serial_number: m.serial_number || undefined,
          manufacturer: m.manufacturer || undefined,
          size_inch: m.size_inch ? Number(m.size_inch) : undefined,
        }));
        const isComputer = type === "desktop" || type === "laptop";

        if (mode === "create") {
          const id = await createDevice({
            ...base,
            user_ids: selectedUsers.map((u) => u.id),
            paired_with_device_id: pairedWithId,
            paired_monitor_ids: isComputer ? pairedMonitors.map(m => m.id) : undefined,
          });
          if (isComputer && newMonitorPayload.length) {
            await createPairedMonitors(id, newMonitorPayload);
          }
          toast.success("Тоног төхөөрөмж бүртгэгдлээ");
          router.push(`/devices/${id}`);
        } else {
          await updateDevice(device!.id, { ...base, paired_with_device_id: pairedWithId }, "Мэдээлэл засварлагдлаа");
          if (isComputer) {
            await setMonitorPairings(device!.id, pairedMonitors.map(m => m.id));
            if (newMonitorPayload.length) {
              await createPairedMonitors(device!.id, newMonitorPayload);
            }
          }
          toast.success("Хадгалагдлаа");
          router.push(`/devices/${device!.id}`);
        }
      } catch (e: any) {
        toast.error(e.message ?? "Алдаа гарлаа");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* ── Үндсэн мэдээлэл ── */}
      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border/60 px-5 py-3.5">
          <h2 className="text-sm font-semibold">Үндсэн мэдээлэл</h2>
        </div>
        <div className="p-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Нэр *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Жишээ нь: Dell Latitude 5520" className="mt-1" />
          </div>
          <div>
            <Label>Загвар</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Загварын нэр" className="mt-1" />
          </div>
          <div>
            <Label>Серийн дугаар</Label>
            <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="SN-XXXXX" className="mt-1" />
          </div>
          <div>
            <Label>Үйлдвэрлэгч</Label>
            <Input value={mfr} onChange={(e) => setMfr(e.target.value)} placeholder="Dell, HP, Canon..." className="mt-1" />
          </div>
          <div>
            <Label>Байршил</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Өрөө, давхар..." className="mt-1" />
          </div>
          <div>
            <Label>Төрөл *</Label>
            <Select value={type} onValueChange={(v) => setType(v as DeviceType)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEVICE_TYPES.map(([val, cfg]) => (
                  <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Худалдан авсан огноо</Label>
            <Input type="date" value={purchaseDate} onChange={(e) => setPD(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Баталгаат хугацаа дуусах огноо</Label>
            <Input type="date" value={warrantyDate} onChange={(e) => setWD(e.target.value)} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label>Тэмдэглэл</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Нэмэлт мэдээлэл..." className="mt-1 resize-none" rows={3} />
          </div>
        </div>
      </section>

      {/* ── Байгуулллагын бүтэц ── */}
      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border/60 px-5 py-3.5">
          <h2 className="text-sm font-semibold">Харьяалал</h2>
        </div>
        <div className="p-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Байгууллага */}
          <div>
            <Label>Байгууллага</Label>
            <Select value={orgId || NONE} onValueChange={handleOrgChange}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Байгууллага сонгох" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Сонгоогүй —</SelectItem>
                {orgStructure.organizations.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Хэлтэс */}
          <div>
            <Label>Хэлтэс</Label>
            <Select value={heltesId || NONE} onValueChange={handleHeltesChange} disabled={filteredHeltes.length === 0}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Хэлтэс сонгох" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Сонгоогүй —</SelectItem>
                {filteredHeltes.map(h => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Алба */}
          <div>
            <Label>Алба</Label>
            <Select value={albaId || NONE} onValueChange={handleAlbaChange} disabled={filteredAlba.length === 0}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Алба сонгох" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Сонгоогүй —</SelectItem>
                {filteredAlba.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* ── Техникийн үзүүлэлт ── */}
      {(type === "desktop" || type === "laptop") && (
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border/60 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Техникийн үзүүлэлт</h2>
          </div>
          <div className="p-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>CPU</Label><Input value={cpu} onChange={(e) => setCpu(e.target.value)} placeholder="Intel Core i7-1165G7" className="mt-1" /></div>
            <div><Label>RAM (GB)</Label><Input type="number" value={ram} onChange={(e) => setRam(e.target.value)} placeholder="16" className="mt-1" /></div>
            <div><Label>SSD (GB)</Label><Input type="number" value={ssd} onChange={(e) => setSsd(e.target.value)} placeholder="512" className="mt-1" /></div>
            <div><Label>HDD (GB)</Label><Input type="number" value={hdd} onChange={(e) => setHdd(e.target.value)} placeholder="1000" className="mt-1" /></div>
            <div><Label>GPU</Label><Input value={gpu} onChange={(e) => setGpu(e.target.value)} placeholder="NVIDIA RTX 3060" className="mt-1" /></div>
            <div><Label>Үйлдлийн систем</Label><Input value={os} onChange={(e) => setOs(e.target.value)} placeholder="Windows 11 Pro" className="mt-1" /></div>
          </div>
        </section>
      )}
      {type === "monitor" && (
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border/60 px-5 py-3.5"><h2 className="text-sm font-semibold">Техникийн үзүүлэлт</h2></div>
          <div className="p-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div><Label>Дэлгэцийн хэмжээ (inch)</Label><Input type="number" value={monSize} onChange={(e) => setMonSize(e.target.value)} placeholder="27" className="mt-1" /></div>
            <div><Label>Нягтрал</Label><Input value={resolution} onChange={(e) => setRes(e.target.value)} placeholder="1920x1080" className="mt-1" /></div>
            <div><Label>Панелийн төрөл</Label><Input value={panelType} onChange={(e) => setPanel(e.target.value)} placeholder="IPS / TN / VA" className="mt-1" /></div>
          </div>
        </section>
      )}
      {(type === "printer" || type === "scanner") && (
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border/60 px-5 py-3.5"><h2 className="text-sm font-semibold">Техникийн үзүүлэлт</h2></div>
          <div className="p-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><Label>Холболтын төрөл</Label><Input value={connection} onChange={(e) => setConn(e.target.value)} placeholder="USB / Сүлжээ" className="mt-1" /></div>
            <div className="flex items-center gap-3 mt-5">
              <input type="checkbox" id="color" checked={colorCapable} onChange={(e) => setClr(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="color" className="text-sm font-medium">Өнгөт хэвлэлт</label>
            </div>
          </div>
        </section>
      )}
      {/* ── Хариуцагчид ── */}
      {mode === "create" && (
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border/60 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Хариуцагчид</h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Нэрээр хайх..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
              {userResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-md">
                  {userResults.map((u) => (
                    <button key={u.id} type="button" onClick={() => addUser(u)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50">
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
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((u, i) => (
                  <div key={u.id} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-sm">
                    {i === 0 && <span className="text-xs text-primary font-semibold">Үндсэн</span>}
                    <span>{u.last_name} {u.first_name}</span>
                    <button onClick={() => removeUser(u.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Pairing: Monitor → Computer ── */}
      {type === "monitor" && (
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border/60 px-5 py-3.5">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Laptop2 className="h-4 w-4" />
              Хамт ашиглах компьютер
            </h2>
          </div>
          <div className="p-5">
            {pairedComputer ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
                <Laptop2 className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary">{pairedComputer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {DEVICE_TYPE_CONFIG[pairedComputer.device_type as DeviceType]?.label ?? pairedComputer.device_type}
                    {pairedComputer.model ? ` · ${pairedComputer.model}` : ""}
                    {pairedComputer.serial_number ? ` · ${pairedComputer.serial_number}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setPairedComputer(null)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Компьютерийн нэр, загвар, серийн дугаараар хайх..."
                  value={computerSearch}
                  onChange={(e) => setComputerSearch(e.target.value)}
                  className="pl-9"
                />
                {computerResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-md max-h-64 overflow-y-auto">
                    {computerResults.map((c) => (
                      <button
                        key={c.id} type="button"
                        onClick={() => { setPairedComputer(c); setComputerSearch(""); setComputerResults([]); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Laptop2 className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {DEVICE_TYPE_CONFIG[c.device_type as DeviceType]?.label}
                            {c.model ? ` · ${c.model}` : ""}
                            {c.serial_number ? ` · ${c.serial_number}` : ""}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Pairing: Computer → Monitors (multi) ── */}
      {(type === "desktop" || type === "laptop") && (
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border/60 px-5 py-3.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <MonitorIcon className="h-4 w-4" />
              Хамт ашиглах дэлгэцүүд
            </h2>
            <span className="text-xs text-muted-foreground">{pairedMonitors.length} ширхэг</span>
          </div>
          <div className="p-5 space-y-3">
            {pairedMonitors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pairedMonitors.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-sm">
                    <MonitorIcon className="h-3 w-3 text-muted-foreground" />
                    <span>{m.name}</span>
                    {m.serial_number && <span className="text-xs text-muted-foreground font-mono">({m.serial_number})</span>}
                    <button type="button" onClick={() => setPairedMonitors(p => p.filter(x => x.id !== m.id))} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Дэлгэцийн нэр, загвар, серийн дугаараар хайх..."
                value={monitorSearch}
                onChange={(e) => setMonitorSearch(e.target.value)}
                className="pl-9"
              />
              {monitorResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-md max-h-64 overflow-y-auto">
                  {monitorResults.map((m) => (
                    <button
                      key={m.id} type="button"
                      onClick={() => {
                        setPairedMonitors(p => [...p, m]);
                        setMonitorSearch(""); setMonitorResults([]);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <MonitorIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.model ? `${m.model} · ` : ""}
                          {m.serial_number ?? ""}
                        </p>
                      </div>
                      {m.paired_with_device_id && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          Өөр компьютертэй
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Хайж олоод сонгоход эндээс ширхэг бүрийг арилгах боломжтой. Аль хэдийн өөр компьютертэй холбогдсон дэлгэцийг сонговол тэр холбоо нь шинэчлэгдэн энэ компьютерт шилжинэ.
            </p>

            {/* New monitors to be created on submit */}
            {newMonitors.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {newMonitors.map((m) => (
                  <div key={m.localId} className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                    <Sparkles className="h-3 w-3" />
                    <span className="font-medium">{m.name}</span>
                    {m.serial_number && <span className="text-xs font-mono opacity-70">({m.serial_number})</span>}
                    <span className="text-[10px] uppercase tracking-wide font-semibold opacity-80">шинэ</span>
                    <button type="button" onClick={() => removeNewMonitor(m.localId)} className="text-emerald-700/70 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline create new monitor */}
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/10">
              {!draftOpen ? (
                <button
                  type="button"
                  onClick={() => setDraftOpen(true)}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                  Шинэ дэлгэц нэмж бүртгэх
                </button>
              ) : (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Шинэ дэлгэц</p>
                    <button
                      type="button"
                      onClick={() => { setDraftMonitor(blankNewMonitor()); setDraftOpen(false); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Label>Нэр *</Label>
                      <Input
                        value={draftMonitor.name}
                        onChange={(e) => setDraftMonitor(p => ({ ...p, name: e.target.value }))}
                        placeholder="Жишээ нь: Dell P2419H"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Үйлдвэрлэгч</Label>
                      <Input
                        value={draftMonitor.manufacturer}
                        onChange={(e) => setDraftMonitor(p => ({ ...p, manufacturer: e.target.value }))}
                        placeholder="Dell, HP..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Загвар</Label>
                      <Input
                        value={draftMonitor.model}
                        onChange={(e) => setDraftMonitor(p => ({ ...p, model: e.target.value }))}
                        placeholder="Загвар"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Серийн дугаар</Label>
                      <Input
                        value={draftMonitor.serial_number}
                        onChange={(e) => setDraftMonitor(p => ({ ...p, serial_number: e.target.value }))}
                        placeholder="SN-XXXXX"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Хэмжээ (inch)</Label>
                      <Input
                        type="number"
                        value={draftMonitor.size_inch}
                        onChange={(e) => setDraftMonitor(p => ({ ...p, size_inch: e.target.value }))}
                        placeholder="24"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={addDraftMonitor} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Нэмэх
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setDraftMonitor(blankNewMonitor()); setDraftOpen(false); }}>
                      Болих
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Үйлдвэрлэгч / Загвар / Серийн дугаар нь заавал биш — үндсэн нь "Нэр". Бусад мэдээллийг дараа дэлгэрэнгүй хуудаснаас засаж болно.
                    Хадгалах товч дарах үед энэ компьютертэй автоматаар холбогдоно.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Товчлуурууд ── */}
      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Хадгалж байна..." : mode === "create" ? "Бүртгэх" : "Хадгалах"}
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={pending}>Болих</Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}
