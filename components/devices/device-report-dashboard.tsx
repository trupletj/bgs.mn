"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, AreaChart, Area, RadialBarChart, RadialBar,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DEVICE_TYPE_CONFIG, type DeviceType, type OrgStructure } from "@/types/device";
import { REQUEST_TYPE_CONFIG, PRIORITY_CONFIG } from "@/components/devices/request-shared";
import type { DeviceRequestType, DeviceRequestPriority, DeviceRequestStatus } from "@/actions/devices";
import {
  Package2, Users, Clock, AlertTriangle, BarChart3, PieChart as PieIcon,
  TrendingUp, Layers, Building2,
} from "lucide-react";
import { RequestFlowAnalytics } from "@/components/devices/device-report-requests";

const ALL = "__all__";

// ─── Color palettes ────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  desktop: "#6366f1",  // indigo
  laptop:  "#06b6d4",  // cyan
  monitor: "#10b981",  // emerald
  printer: "#f59e0b",  // amber
  scanner: "#f97316",  // orange
};

const STATUS_COLORS: Record<DeviceRequestStatus, string> = {
  pending:  "#f59e0b",
  approved: "#10b981",
  rejected: "#ef4444",
};

const PRIORITY_COLORS: Record<DeviceRequestPriority, string> = {
  urgent: "#ef4444",
  normal: "#3b82f6",
  low:    "#94a3b8",
};

const REQUEST_TYPE_COLORS: Record<DeviceRequestType, string> = {
  new:          "#6366f1",
  replace:      "#06b6d4",
  transfer:     "#10b981",
  decommission: "#ef4444",
  repair:       "#f59e0b",
};

interface Props {
  devices: any[];
  requests: any[];
  orgStructure: OrgStructure;
}

type GroupBy = "organization" | "heltes" | "alba";
type ViewMode = "bar" | "stacked" | "pie" | "table";

export function DeviceReportDashboard({ devices, requests, orgStructure }: Props) {
  // ── Filter state ──
  const [orgFilter, setOrgFilter] = useState("");
  const [heltesFilter, setHeltesFilter] = useState("");
  const [albaFilter, setAlbaFilter] = useState("");

  // ── View controls ──
  const [groupBy, setGroupBy] = useState<GroupBy>("organization");
  const [viewMode, setViewMode] = useState<ViewMode>("stacked");

  // ── Filtered datasets ──
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      if (orgFilter && d.organization?.id !== orgFilter) return false;
      if (heltesFilter && d.heltes?.id !== heltesFilter) return false;
      if (albaFilter && d.alba?.id !== albaFilter) return false;
      return true;
    });
  }, [devices, orgFilter, heltesFilter, albaFilter]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (orgFilter) {
        const org = orgStructure.organizations.find(o => o.id === orgFilter);
        if (org && r.req_org_bteg !== org.bteg_id) return false;
      }
      if (heltesFilter) {
        const h = orgStructure.heltes.find(h => h.id === heltesFilter);
        if (h && r.req_heltes_bteg !== h.bteg_id) return false;
      }
      if (albaFilter) {
        const a = orgStructure.alba.find(a => a.id === albaFilter);
        if (a && r.req_alba_bteg !== a.bteg_id) return false;
      }
      return true;
    });
  }, [requests, orgFilter, heltesFilter, albaFilter, orgStructure]);

  // ── Cascade options ──
  const selectedOrg = orgStructure.organizations.find(o => o.id === orgFilter);
  const heltesOptions = useMemo(
    () => selectedOrg ? orgStructure.heltes.filter(h => h.org_bteg_id === selectedOrg.bteg_id) : orgStructure.heltes,
    [selectedOrg, orgStructure.heltes]
  );
  const selectedHeltes = orgStructure.heltes.find(h => h.id === heltesFilter);
  const albaOptions = useMemo(
    () => selectedHeltes ? orgStructure.alba.filter(a => a.heltes_bteg_id === selectedHeltes.bteg_id) :
          selectedOrg ? orgStructure.alba.filter(a => a.org_bteg_id === selectedOrg.bteg_id) :
          orgStructure.alba,
    [selectedHeltes, selectedOrg, orgStructure.alba]
  );

  // ── KPIs ──
  const kpis = useMemo(() => {
    const totalDevices = filteredDevices.length;
    const assignedDevices = filteredDevices.filter(d => (d.device_assignments?.length ?? 0) > 0).length;
    const pendingRequests = filteredRequests.filter(r => r.status === "pending").length;
    const urgentRequests  = filteredRequests.filter(r => r.priority === "urgent" && r.status === "pending").length;
    return { totalDevices, assignedDevices, pendingRequests, urgentRequests };
  }, [filteredDevices, filteredRequests]);

  // ── Devices by type (pie data) ──
  const devicesByType = useMemo(() => {
    return Object.entries(DEVICE_TYPE_CONFIG)
      .map(([type, cfg]) => ({
        name: cfg.label,
        type,
        value: filteredDevices.filter(d => d.device_type === type).length,
        color: TYPE_COLORS[type] ?? "#94a3b8",
      }))
      .filter(d => d.value > 0);
  }, [filteredDevices]);

  // ── Requests by status ──
  const requestsByStatus = useMemo(() => {
    return (["pending", "approved", "rejected"] as DeviceRequestStatus[]).map(s => ({
      name: s === "pending" ? "Хүлээгдэж буй" : s === "approved" ? "Зөвшөөрөгдсөн" : "Татгалзсан",
      status: s,
      value: filteredRequests.filter(r => r.status === s).length,
      color: STATUS_COLORS[s],
    }));
  }, [filteredRequests]);

  // ── Requests by priority ──
  const requestsByPriority = useMemo(() => {
    return (["urgent", "normal", "low"] as DeviceRequestPriority[]).map(p => ({
      name: PRIORITY_CONFIG[p].label,
      priority: p,
      value: filteredRequests.filter(r => (r.priority ?? "normal") === p).length,
      color: PRIORITY_COLORS[p],
    }));
  }, [filteredRequests]);

  // ── Requests by type ──
  const requestsByType = useMemo(() => {
    return (Object.entries(REQUEST_TYPE_CONFIG) as [DeviceRequestType, typeof REQUEST_TYPE_CONFIG[DeviceRequestType]][])
      .map(([type, cfg]) => ({
        name: cfg.label,
        type,
        value: filteredRequests.filter(r => r.request_type === type).length,
        color: REQUEST_TYPE_COLORS[type],
      }))
      .filter(d => d.value > 0);
  }, [filteredRequests]);

  // ── Request trend by month (last 12 months) ──
  const requestTrend = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; value: number; pending: number; approved: number; rejected: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}`,
        value: 0, pending: 0, approved: 0, rejected: 0,
      });
    }
    const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
    for (const r of filteredRequests) {
      const dt = new Date(r.created_at);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const i = idx[key];
      if (i !== undefined) {
        months[i].value += 1;
        if (r.status === "pending")  months[i].pending  += 1;
        if (r.status === "approved") months[i].approved += 1;
        if (r.status === "rejected") months[i].rejected += 1;
      }
    }
    return months;
  }, [filteredRequests]);

  // ── Devices grouped by org / heltes / alba (with type breakdown) ──
  const groupedDevices = useMemo(() => {
    const map = new Map<string, { name: string; total: number; byType: Record<string, number> }>();
    for (const d of filteredDevices) {
      let key: string | null = null;
      if (groupBy === "organization") key = d.organization?.name ?? null;
      else if (groupBy === "heltes")  key = d.heltes?.name ?? d.heltes_name ?? null;
      else                            key = d.alba?.name ?? d.department_name ?? null;
      if (!key) key = "Тодорхойгүй";
      if (!map.has(key)) map.set(key, { name: key, total: 0, byType: {} });
      const g = map.get(key)!;
      g.total += 1;
      g.byType[d.device_type] = (g.byType[d.device_type] ?? 0) + 1;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredDevices, groupBy]);

  // For stacked bar chart, build rows with a column per device type
  const stackedData = useMemo(() => {
    return groupedDevices.slice(0, 15).map(g => {
      const row: Record<string, any> = { name: g.name };
      for (const [type, cfg] of Object.entries(DEVICE_TYPE_CONFIG)) {
        row[cfg.label] = g.byType[type] ?? 0;
      }
      row.total = g.total;
      return row;
    });
  }, [groupedDevices]);

  const hasFilters = !!orgFilter || !!heltesFilter || !!albaFilter;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Building2 className="h-4 w-4 text-muted-foreground ml-1" />
        <Select value={orgFilter || ALL} onValueChange={v => { setOrgFilter(v === ALL ? "" : v); setHeltesFilter(""); setAlbaFilter(""); }}>
          <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue placeholder="Байгууллага" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Бүх байгуулга</SelectItem>
            {orgStructure.organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={heltesFilter || ALL} disabled={!orgFilter} onValueChange={v => { setHeltesFilter(v === ALL ? "" : v); setAlbaFilter(""); }}>
          <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue placeholder="Хэлтэс" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Бүх хэлтэс</SelectItem>
            {heltesOptions.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={albaFilter || ALL} disabled={!heltesFilter} onValueChange={v => setAlbaFilter(v === ALL ? "" : v)}>
          <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue placeholder="Алба" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Бүх алба</SelectItem>
            {albaOptions.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <button
            onClick={() => { setOrgFilter(""); setHeltesFilter(""); setAlbaFilter(""); }}
            className="text-xs text-muted-foreground hover:text-foreground ml-2"
          >
            Цэвэрлэх
          </button>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Нийт төхөөрөмж" value={kpis.totalDevices} icon={Package2} color="indigo" />
        <KpiCard label="Хариуцагчтай"   value={kpis.assignedDevices} sub={`${kpis.totalDevices ? Math.round(kpis.assignedDevices / kpis.totalDevices * 100) : 0}%`} icon={Users} color="emerald" />
        <KpiCard label="Хүлээгдэж буй"  value={kpis.pendingRequests} icon={Clock} color="amber" />
        <KpiCard label="Яаралтай"        value={kpis.urgentRequests}  icon={AlertTriangle} color="red" />
      </div>

      {/* ── Two-col donuts ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Төрлөөр" subtitle={`${kpis.totalDevices} төхөөрөмж`} icon={PieIcon}>
          <DonutChart data={devicesByType} />
        </ChartCard>
        <ChartCard title="Хүсэлтийн төлөв" subtitle={`${filteredRequests.length} хүсэлт`} icon={BarChart3}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={requestsByStatus} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {requestsByStatus.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Big interactive chart ── */}
      <ChartCard
        title="Байгууллага / хэлтэс / албаар хуваарилалт"
        subtitle={`${groupedDevices.length} нэгж`}
        icon={Layers}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Байгууллага</SelectItem>
                <SelectItem value="heltes">Хэлтэс</SelectItem>
                <SelectItem value="alba">Алба</SelectItem>
              </SelectContent>
            </Select>
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        }
      >
        {groupedDevices.length === 0 ? (
          <EmptyChart />
        ) : viewMode === "pie" ? (
          <DonutChart data={groupedDevices.slice(0, 12).map((g, i) => ({
            name: g.name, value: g.total, color: PALETTE[i % PALETTE.length],
          }))} />
        ) : viewMode === "table" ? (
          <GroupedTable groups={groupedDevices} />
        ) : viewMode === "bar" ? (
          <ResponsiveContainer width="100%" height={Math.max(280, stackedData.length * 32 + 60)}>
            <BarChart data={stackedData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="total" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, stackedData.length * 32 + 60)}>
            <BarChart data={stackedData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {Object.entries(DEVICE_TYPE_CONFIG).map(([type, cfg]) => (
                <Bar key={type} dataKey={cfg.label} stackId="a" fill={TYPE_COLORS[type] ?? "#94a3b8"} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Trend + priority/type ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Хүсэлтийн чиг хандлага (12 сар)" icon={TrendingUp} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={requestTrend} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="grad-pending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-approved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-rejected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" name="Хүлээгдэж буй" dataKey="pending"  stackId="1" stroke="#f59e0b" fill="url(#grad-pending)" />
              <Area type="monotone" name="Зөвшөөрөгдсөн" dataKey="approved" stackId="1" stroke="#10b981" fill="url(#grad-approved)" />
              <Area type="monotone" name="Татгалзсан"   dataKey="rejected" stackId="1" stroke="#ef4444" fill="url(#grad-rejected)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Зэрэглэлээр" icon={AlertTriangle}>
          <ResponsiveContainer width="100%" height={260}>
            <RadialBarChart innerRadius="35%" outerRadius="100%" data={requestsByPriority} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" background={{ fill: "#f1f5f9" }} cornerRadius={6}>
                {requestsByPriority.map((d, i) => <Cell key={i} fill={d.color} />)}
              </RadialBar>
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Request type breakdown ── */}
      {requestsByType.length > 0 && (
        <ChartCard title="Хүсэлт төрлөөр" icon={BarChart3} subtitle={`${filteredRequests.length} хүсэлт`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={requestsByType} margin={{ left: 0, right: 10, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {requestsByType.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── Request flow analytics ── */}
      <RequestFlowAnalytics
        devices={filteredDevices}
        requests={filteredRequests}
        orgStructure={orgStructure}
      />
    </div>
  );
}

// ─── KPI card ──────────────────────────────────────────────────────────────

const KPI_COLORS: Record<string, string> = {
  indigo:  "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber:   "bg-amber-50 text-amber-600",
  red:     "bg-red-50 text-red-600",
};

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: number; sub?: string; icon: React.ElementType; color: keyof typeof KPI_COLORS;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold tabular-nums mt-1">{value.toLocaleString()}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", KPI_COLORS[color])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}

// ─── Chart wrapper card ────────────────────────────────────────────────────

function ChartCard({
  title, subtitle, icon: Icon, action, className, children,
}: {
  title: string; subtitle?: string; icon?: React.ElementType;
  action?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// ─── Donut chart ────────────────────────────────────────────────────────────

function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  if (data.length === 0) return <EmptyChart />;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data} dataKey="value" cx="50%" cy="50%"
            innerRadius={55} outerRadius={85} paddingAngle={2}
          >
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="flex-1 min-w-0 truncate">{d.name}</span>
            <span className="font-semibold tabular-nums">{d.value}</span>
            <span className="text-muted-foreground tabular-nums w-10 text-right">
              {total ? ((d.value / total) * 100).toFixed(0) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── View mode toggle ──────────────────────────────────────────────────────

function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: { v: ViewMode; label: string }[] = [
    { v: "stacked", label: "Багана+" },
    { v: "bar",     label: "Багана"  },
    { v: "pie",     label: "Тойрог"  },
    { v: "table",   label: "Хүснэгт" },
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

// ─── Grouped table ─────────────────────────────────────────────────────────

function GroupedTable({ groups }: { groups: { name: string; total: number; byType: Record<string, number> }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-xs text-muted-foreground">
            <th className="text-left py-2 px-2 font-medium">Нэгж</th>
            {Object.entries(DEVICE_TYPE_CONFIG).map(([type, cfg]) => (
              <th key={type} className="text-right py-2 px-2 font-medium whitespace-nowrap">{cfg.label}</th>
            ))}
            <th className="text-right py-2 px-2 font-semibold">Нийт</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.name} className="border-b border-border/30 hover:bg-muted/20">
              <td className="py-2 px-2 font-medium">{g.name}</td>
              {Object.keys(DEVICE_TYPE_CONFIG).map(type => (
                <td key={type} className="text-right py-2 px-2 tabular-nums text-muted-foreground">
                  {g.byType[type] ?? "—"}
                </td>
              ))}
              <td className="text-right py-2 px-2 font-bold tabular-nums">{g.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
      <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/30" />
      Өгөгдөл байхгүй
    </div>
  );
}

const PALETTE = [
  "#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#f97316", "#a855f7", "#ec4899", "#14b8a6", "#84cc16",
  "#0ea5e9", "#d946ef",
];
