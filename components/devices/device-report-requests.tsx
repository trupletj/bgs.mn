"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEVICE_TYPE_CONFIG, type DeviceType, type OrgStructure } from "@/types/device";
import {
  Building2, Package2, Plus, RefreshCw as RefreshIcon, ArrowRightLeft,
  Trash2, Wrench, ArrowRight, TrendingDown, TrendingUp, Layers,
} from "lucide-react";

const ALL = "__all__";

const REQUEST_TYPE_COLORS = {
  new:          "#6366f1",
  replace:      "#06b6d4",
  transfer:     "#10b981",
  decommission: "#ef4444",
  repair:       "#f59e0b",
} as const;

const COLUMN_META = [
  { key: "current",      label: "Одоо байгаа",  icon: Package2,    color: "slate" },
  { key: "new",          label: "Шинээр",        icon: Plus,        color: "indigo" },
  { key: "replace",      label: "Шинэчлэх",      icon: RefreshIcon, color: "cyan" },
  { key: "outgoing",     label: "Шилжүүлж буй",  icon: TrendingDown, color: "emerald" },
  { key: "incoming",     label: "Хүлээн авах",   icon: TrendingUp,  color: "emerald" },
  { key: "decommission", label: "Актлах",        icon: Trash2,      color: "red" },
  { key: "repair",       label: "Засвар",        icon: Wrench,      color: "amber" },
] as const;

type Metric = typeof COLUMN_META[number]["key"];
type GroupBy = "organization" | "heltes" | "alba";
type View = "matrix" | "bar" | "flow";

interface Props {
  devices: any[];
  requests: any[];
  orgStructure: OrgStructure;
}

export function RequestFlowAnalytics({ devices, requests, orgStructure }: Props) {
  const [groupBy, setGroupBy]                 = useState<GroupBy>("heltes");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>("all");
  const [view, setView]                       = useState<View>("matrix");

  // Build name lookups
  const orgByBteg = useMemo(
    () => Object.fromEntries(orgStructure.organizations.map(o => [o.bteg_id, o.name])),
    [orgStructure.organizations]
  );
  const heltesByBteg = useMemo(
    () => Object.fromEntries(orgStructure.heltes.map(h => [h.bteg_id, h.name])),
    [orgStructure.heltes]
  );
  const albaByBteg = useMemo(
    () => Object.fromEntries(orgStructure.alba.map(a => [a.bteg_id, a.name])),
    [orgStructure.alba]
  );

  // Filtered datasets
  const filteredRequests = useMemo(
    () => deviceTypeFilter === "all" ? requests : requests.filter(r => r.device_type === deviceTypeFilter),
    [requests, deviceTypeFilter]
  );
  const filteredDevices = useMemo(
    () => deviceTypeFilter === "all" ? devices : devices.filter(d => d.device_type === deviceTypeFilter),
    [devices, deviceTypeFilter]
  );

  // Helpers to extract a department key for a given grouping
  const reqDeptName = (r: any): string | null => {
    if (groupBy === "organization") return orgByBteg[r.req_org_bteg] ?? null;
    if (groupBy === "heltes")       return heltesByBteg[r.req_heltes_bteg] ?? null;
    return albaByBteg[r.req_alba_bteg] ?? null;
  };
  const transferDestName = (r: any): string | null => {
    if (groupBy === "organization") return orgByBteg[r.transfer_to_org_bteg] ?? null;
    if (groupBy === "heltes")       return heltesByBteg[r.transfer_to_heltes_bteg] ?? null;
    return albaByBteg[r.transfer_to_alba_bteg] ?? null;
  };
  const deviceDeptName = (d: any): string | null => {
    if (groupBy === "organization") return d.organization?.name ?? null;
    if (groupBy === "heltes")       return d.heltes?.name ?? d.heltes_name ?? null;
    return d.alba?.name ?? d.department_name ?? null;
  };

  // Aggregate per department
  const aggregated = useMemo(() => {
    const map = new Map<string, Record<Metric, number> & { total: number }>();
    const ensure = (name: string) => {
      if (!map.has(name)) {
        map.set(name, { current: 0, new: 0, replace: 0, outgoing: 0, incoming: 0, decommission: 0, repair: 0, total: 0 });
      }
      return map.get(name)!;
    };

    // Existing devices
    for (const d of filteredDevices) {
      const name = deviceDeptName(d);
      if (!name) continue;
      ensure(name).current += 1;
    }

    // Requests
    for (const r of filteredRequests) {
      const fromName = reqDeptName(r);
      const toName   = transferDestName(r);

      if (fromName) {
        const row = ensure(fromName);
        if (r.request_type === "new")          row.new += 1;
        else if (r.request_type === "replace") row.replace += 1;
        else if (r.request_type === "transfer") row.outgoing += 1;
        else if (r.request_type === "decommission") row.decommission += 1;
        else if (r.request_type === "repair")  row.repair += 1;
        row.total += 1;
      }

      // Incoming for any transfer destination
      if (toName && r.request_type === "transfer") {
        ensure(toName).incoming += 1;
      }
      if (toName && r.request_type === "replace" && r.transfer_old) {
        ensure(toName).incoming += 1;
      }
    }

    return Array.from(map.entries())
      .map(([name, m]) => ({ name, ...m }))
      .sort((a, b) => (b.total + b.incoming) - (a.total + a.incoming));
  }, [filteredDevices, filteredRequests, groupBy, orgByBteg, heltesByBteg, albaByBteg]);

  // Find max value per metric for heatmap intensity scaling
  const maxByMetric = useMemo(() => {
    const m: Record<string, number> = {};
    for (const col of COLUMN_META) {
      m[col.key] = aggregated.reduce((max, row) => Math.max(max, (row as any)[col.key]), 0);
    }
    return m;
  }, [aggregated]);

  // Transfer flows (source → dest)
  const transferFlows = useMemo(() => {
    const map = new Map<string, { from: string; to: string; total: number; byType: Record<string, number> }>();
    for (const r of filteredRequests) {
      if (r.request_type !== "transfer" && !(r.request_type === "replace" && r.transfer_old)) continue;
      const from = reqDeptName(r);
      const to   = transferDestName(r);
      if (!from || !to) continue;
      const key = `${from}||${to}`;
      if (!map.has(key)) map.set(key, { from, to, total: 0, byType: {} });
      const entry = map.get(key)!;
      entry.total += 1;
      const dt = r.device_type ?? "unknown";
      entry.byType[dt] = (entry.byType[dt] ?? 0) + 1;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredRequests, groupBy, orgByBteg, heltesByBteg, albaByBteg]);

  // Bar chart data — stacked by request type
  const barData = useMemo(() => {
    return aggregated.slice(0, 15).map(row => ({
      name: row.name,
      "Шинээр": row.new,
      "Шинэчлэх": row.replace,
      "Шилжүүлэх": row.outgoing,
      "Актлах": row.decommission,
      "Засвар": row.repair,
    }));
  }, [aggregated]);

  // Quick KPIs at top of section
  const totalNew      = filteredRequests.filter(r => r.request_type === "new").length;
  const totalReplace  = filteredRequests.filter(r => r.request_type === "replace").length;
  const totalTransfer = filteredRequests.filter(r => r.request_type === "transfer").length;
  const totalRepair   = filteredRequests.filter(r => r.request_type === "repair").length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">Хүсэлтийн хэлтэс хоорондын урсгал</h2>
            <p className="text-xs text-muted-foreground">
              Тухайн алба/хэлтэс ямар төхөөрөмжөөс хэдийг хүсч, хаана шилжүүлж байгааг дүрслэн харуулна
            </p>
          </div>
        </div>

        {/* Top KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MiniKpi icon={Plus}          label="Шинээр"     value={totalNew}      color="indigo" />
          <MiniKpi icon={RefreshIcon}   label="Шинэчлэх"   value={totalReplace}  color="cyan" />
          <MiniKpi icon={ArrowRightLeft} label="Шилжүүлэх" value={totalTransfer} color="emerald" />
          <MiniKpi icon={Wrench}        label="Засвар"      value={totalRepair}   color="amber" />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Device type pills */}
          <div className="flex flex-wrap gap-1">
            <FilterPill active={deviceTypeFilter === "all"} onClick={() => setDeviceTypeFilter("all")}>
              Бүх төхөөрөмж
            </FilterPill>
            {Object.entries(DEVICE_TYPE_CONFIG).map(([key, cfg]) => (
              <FilterPill key={key} active={deviceTypeFilter === key} onClick={() => setDeviceTypeFilter(key)}>
                {cfg.label}
              </FilterPill>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Байгууллага</SelectItem>
                <SelectItem value="heltes">Хэлтэс</SelectItem>
                <SelectItem value="alba">Алба</SelectItem>
              </SelectContent>
            </Select>
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        {aggregated.length === 0 ? (
          <Empty message="Тохирох өгөгдөл байхгүй" />
        ) : view === "matrix" ? (
          <MatrixHeatmap rows={aggregated} maxByMetric={maxByMetric} />
        ) : view === "bar" ? (
          <ResponsiveContainer width="100%" height={Math.max(280, barData.length * 32 + 60)}>
            <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Шинээр"    stackId="a" fill={REQUEST_TYPE_COLORS.new} />
              <Bar dataKey="Шинэчлэх"  stackId="a" fill={REQUEST_TYPE_COLORS.replace} />
              <Bar dataKey="Шилжүүлэх" stackId="a" fill={REQUEST_TYPE_COLORS.transfer} />
              <Bar dataKey="Актлах"    stackId="a" fill={REQUEST_TYPE_COLORS.decommission} />
              <Bar dataKey="Засвар"    stackId="a" fill={REQUEST_TYPE_COLORS.repair} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <FlowView flows={transferFlows} />
        )}
      </div>
    </div>
  );
}

// ─── Matrix heatmap ────────────────────────────────────────────────────────

function MatrixHeatmap({
  rows, maxByMetric,
}: {
  rows: { name: string; current: number; new: number; replace: number; outgoing: number; incoming: number; decommission: number; repair: number; total: number }[];
  maxByMetric: Record<string, number>;
}) {
  // intensity 0..1 → background HSL
  const cellBg = (value: number, max: number, baseColor: string) => {
    if (value === 0) return undefined;
    const intensity = max > 0 ? value / max : 0;
    return { background: `${baseColor}${Math.round(intensity * 255).toString(16).padStart(2, "0")}` };
  };

  const COLORS: Record<string, string> = {
    slate:   "#64748b",
    indigo:  "#6366f1",
    cyan:    "#06b6d4",
    emerald: "#10b981",
    red:     "#ef4444",
    amber:   "#f59e0b",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="text-left py-2.5 px-3 font-medium text-xs text-muted-foreground sticky left-0 bg-card z-10">
              <Building2 className="inline-block h-3.5 w-3.5 mr-1.5" />
              Нэгж
            </th>
            {COLUMN_META.map(col => (
              <th key={col.key} className="text-center py-2.5 px-3 font-medium text-xs text-muted-foreground whitespace-nowrap">
                <div className="flex items-center justify-center gap-1">
                  <col.icon className="h-3.5 w-3.5" style={{ color: COLORS[col.color] }} />
                  {col.label}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.name} className="border-b border-border/40 hover:bg-muted/20">
              <td className="py-2 px-3 font-medium sticky left-0 bg-card z-10">{row.name}</td>
              {COLUMN_META.map(col => {
                const value = (row as any)[col.key] as number;
                const max = maxByMetric[col.key];
                return (
                  <td
                    key={col.key}
                    className="text-center py-2 px-3 tabular-nums"
                    style={cellBg(value, max, COLORS[col.color])}
                  >
                    {value === 0 ? (
                      <span className="text-muted-foreground/30">—</span>
                    ) : (
                      <span className={cn("font-semibold", value / Math.max(max, 1) > 0.5 && "text-white")}>
                        {value}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Flow view (transfer source → destination) ────────────────────────────

function FlowView({ flows }: { flows: { from: string; to: string; total: number; byType: Record<string, number> }[] }) {
  if (flows.length === 0) {
    return <Empty message="Шилжүүлэх хүсэлт байхгүй байна" />;
  }
  const maxTotal = Math.max(...flows.map(f => f.total));
  return (
    <div className="flex flex-col gap-2">
      {flows.map((flow, i) => {
        const intensity = maxTotal > 0 ? flow.total / maxTotal : 0;
        return (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center rounded-lg border border-border/60 bg-muted/10 p-3 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
          >
            {/* Source */}
            <div className="flex items-center gap-2 min-w-0 justify-end">
              <div className="text-right min-w-0">
                <p className="text-sm font-medium truncate">{flow.from}</p>
                <p className="text-xs text-muted-foreground">Эх үүсвэр</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <Building2 className="h-4 w-4" />
              </div>
            </div>

            {/* Arrow + count */}
            <div className="flex flex-col items-center gap-1 min-w-[120px]">
              <div
                className="px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ background: `rgba(16, 185, 129, ${0.5 + intensity * 0.5})` }}
              >
                {flow.total} төхөөрөмж
              </div>
              <div
                className="h-0.5 w-full bg-emerald-400 relative"
                style={{ background: `rgba(16, 185, 129, ${0.4 + intensity * 0.6})` }}
              >
                <ArrowRight className="h-4 w-4 text-emerald-500 absolute -right-1.5 -top-2" />
              </div>
              <div className="flex flex-wrap gap-1 justify-center">
                {Object.entries(flow.byType).map(([type, count]) => (
                  <span key={type} className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    {DEVICE_TYPE_CONFIG[type as DeviceType]?.label ?? type}: {count}
                  </span>
                ))}
              </div>
            </div>

            {/* Destination */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{flow.to}</p>
                <p className="text-xs text-muted-foreground">Хүлээн авагч</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── UI Helpers ────────────────────────────────────────────────────────────

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-transparent text-muted-foreground hover:text-foreground border-border"
      )}
    >
      {children}
    </button>
  );
}

const MINI_COLORS: Record<string, string> = {
  indigo:  "bg-indigo-50 text-indigo-600",
  cyan:    "bg-cyan-50 text-cyan-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber:   "bg-amber-50 text-amber-600",
};

function MiniKpi({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: keyof typeof MINI_COLORS }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-md shrink-0", MINI_COLORS[color])}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold tabular-nums leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const options: { v: View; label: string }[] = [
    { v: "matrix", label: "Хүснэгт" },
    { v: "bar",    label: "Багана" },
    { v: "flow",   label: "Урсгал" },
  ];
  return (
    <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
      {options.map(o => (
        <button
          key={o.v} onClick={() => onChange(o.v)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === o.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
      <Layers className="mb-2 h-8 w-8 text-muted-foreground/30" />
      {message}
    </div>
  );
}
