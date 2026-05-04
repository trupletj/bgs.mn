"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DEVICE_TYPE_CONFIG, type DeviceType } from "@/types/device";
import {
  REQUEST_TYPE_CONFIG, PRIORITY_CONFIG,
} from "@/components/devices/request-shared";
import type {
  DeviceRequestType, DeviceRequestPriority, DeviceRequestStatus,
} from "@/actions/devices";
import {
  Activity, CheckCircle2, XCircle, Clock, Hourglass, Flame, Timer, AlertTriangle,
} from "lucide-react";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * HOUR_MS;

const TYPE_COLORS: Record<DeviceRequestType, string> = {
  new:          "#6366f1",
  replace:      "#06b6d4",
  transfer:     "#10b981",
  decommission: "#ef4444",
  repair:       "#f59e0b",
};

const STATUS_COLORS: Record<DeviceRequestStatus, string> = {
  pending:  "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

interface Props {
  requests: any[];
}

export function RequestLifecycleAnalytics({ requests }: Props) {
  // ── Lifetime metrics ──
  const metrics = useMemo(() => {
    const now = Date.now();

    const finalized  = requests.filter((r) => r.status === "approved" || r.status === "rejected");
    const approved   = requests.filter((r) => r.status === "approved");
    const rejected   = requests.filter((r) => r.status === "rejected");
    const pending    = requests.filter((r) => r.status === "pending");

    const approvalRate = finalized.length > 0
      ? Math.round((approved.length / finalized.length) * 100)
      : 0;

    // Approve / reject хугацааны дундаж: updated_at - created_at
    const avgMs = (rs: any[]) => {
      if (rs.length === 0) return 0;
      const total = rs.reduce((s, r) => {
        const c = new Date(r.created_at).getTime();
        const u = new Date(r.updated_at ?? r.created_at).getTime();
        return s + Math.max(0, u - c);
      }, 0);
      return total / rs.length;
    };
    const avgApproveMs = avgMs(approved);
    const avgRejectMs  = avgMs(rejected);

    // Pending хүсэлтийн дундаж + хамгийн эртний
    const oldestPending = pending.reduce((max: any, r: any) => {
      const c = new Date(r.created_at).getTime();
      return !max || c < new Date(max.created_at).getTime() ? r : max;
    }, null as any);
    const oldestPendingDays = oldestPending
      ? Math.floor((now - new Date(oldestPending.created_at).getTime()) / DAY_MS)
      : 0;

    return {
      total: requests.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      finalized: finalized.length,
      approvalRate,
      avgApproveMs,
      avgRejectMs,
      oldestPendingDays,
      oldestPending,
      pendingItems: pending,
    };
  }, [requests]);

  // ── Cycle time per request type (approve only, average days) ──
  const cycleByType = useMemo(() => {
    const buckets = new Map<string, { totalMs: number; count: number }>();
    for (const r of requests) {
      if (r.status !== "approved") continue;
      const c = new Date(r.created_at).getTime();
      const u = new Date(r.updated_at ?? r.created_at).getTime();
      const ms = Math.max(0, u - c);
      const key = r.request_type as string;
      const cur = buckets.get(key) ?? { totalMs: 0, count: 0 };
      cur.totalMs += ms; cur.count += 1;
      buckets.set(key, cur);
    }
    return (Object.keys(REQUEST_TYPE_CONFIG) as DeviceRequestType[])
      .map((key) => {
        const b = buckets.get(key) ?? { totalMs: 0, count: 0 };
        const avgDays = b.count > 0 ? b.totalMs / b.count / DAY_MS : 0;
        return {
          type: key,
          name: REQUEST_TYPE_CONFIG[key]?.label ?? key,
          avgDays: Number(avgDays.toFixed(1)),
          count: b.count,
          color: TYPE_COLORS[key],
        };
      })
      .filter((d) => d.count > 0)
      .sort((a, b) => b.avgDays - a.avgDays);
  }, [requests]);

  // ── Top oldest pending (10) ──
  const oldestPendingList = useMemo(() => {
    return [...metrics.pendingItems]
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .slice(0, 10);
  }, [metrics.pendingItems]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">Хүсэлтийн амьдралын мөчлөг</h2>
            <p className="text-xs text-muted-foreground">
              Зөвшөөрөх / татгалзах хурд, хүлээгдэж буй хүсэлтийн хариуцлага
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <KpiTile
            icon={CheckCircle2}
            label="Зөвшөөрлийн хувь"
            value={`${metrics.approvalRate}%`}
            sub={`${metrics.approved} / ${metrics.finalized || 0} шийдэгдсэн`}
            color="emerald"
          />
          <KpiTile
            icon={Timer}
            label="Дундаж зөвшөөрөх"
            value={formatDuration(metrics.avgApproveMs)}
            sub={metrics.approved > 0 ? `${metrics.approved} хүсэлтээс` : "Өгөгдөлгүй"}
            color="indigo"
          />
          <KpiTile
            icon={XCircle}
            label="Дундаж татгалзах"
            value={formatDuration(metrics.avgRejectMs)}
            sub={metrics.rejected > 0 ? `${metrics.rejected} хүсэлтээс` : "Өгөгдөлгүй"}
            color="rose"
          />
          <KpiTile
            icon={Hourglass}
            label="Эртний хүлээлт"
            value={metrics.oldestPendingDays > 0 ? `${metrics.oldestPendingDays} өдөр` : "—"}
            sub={`${metrics.pending} хүлээлтэнд`}
            color={metrics.oldestPendingDays > 7 ? "rose" : metrics.oldestPendingDays > 3 ? "amber" : "slate"}
          />
        </div>

        {/* Status pipeline strip */}
        {metrics.total > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Бүх хүсэлтийн төлөвийн харьцаа
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {metrics.total} нийт
              </p>
            </div>
            <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-muted">
              <div
                style={{ width: `${(metrics.approved / metrics.total) * 100}%` }}
                className="bg-emerald-500"
                title={`Зөвшөөрөгдсөн: ${metrics.approved}`}
              />
              <div
                style={{ width: `${(metrics.pending / metrics.total) * 100}%` }}
                className="bg-amber-500"
                title={`Хүлээгдэж буй: ${metrics.pending}`}
              />
              <div
                style={{ width: `${(metrics.rejected / metrics.total) * 100}%` }}
                className="bg-rose-500"
                title={`Татгалзсан: ${metrics.rejected}`}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                Зөвшөөрсөн{" "}
                <span className="font-semibold tabular-nums">{metrics.approved}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-amber-500" />
                Хүлээгдэж буй{" "}
                <span className="font-semibold tabular-nums">{metrics.pending}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-rose-500" />
                Татгалзсан{" "}
                <span className="font-semibold tabular-nums">{metrics.rejected}</span>
              </span>
            </div>
          </div>
        )}

        {/* Cycle time per request type */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Дундаж зөвшөөрлийн хугацаа төрлөөр (өдөр)
            </p>
          </div>
          {cycleByType.length === 0 ? (
            <Empty message="Шийдэгдсэн хүсэлт алга — дундаж тооцох боломжгүй" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, cycleByType.length * 38 + 30)}>
              <BarChart data={cycleByType} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => [`${v} өдөр`, "Дундаж"]}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
                <Bar dataKey="avgDays" radius={[0, 6, 6, 0]}>
                  {cycleByType.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top oldest pending */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-rose-500" />
              <p className="text-xs font-semibold">Хамгийн удаан хүлээгдэж буй хүсэлт</p>
            </div>
            <p className="text-xs text-muted-foreground">Top {oldestPendingList.length}</p>
          </div>
          {oldestPendingList.length === 0 ? (
            <Empty message="Хүлээгдэж буй хүсэлт алга — бүгд шийдэгдсэн 🎉" />
          ) : (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium w-20">Хугацаа</th>
                    <th className="text-left py-2 px-3 font-medium">Хүсэлт</th>
                    <th className="text-left py-2 px-3 font-medium">Гаргагч</th>
                    <th className="text-left py-2 px-3 font-medium w-24">Зэрэглэл</th>
                    <th className="text-left py-2 px-3 font-medium w-24">Хариуцагч</th>
                  </tr>
                </thead>
                <tbody>
                  {oldestPendingList.map((r) => {
                    const days = Math.floor(
                      (Date.now() - new Date(r.created_at).getTime()) / DAY_MS,
                    );
                    const typeCfg = DEVICE_TYPE_CONFIG[r.device_type as DeviceType];
                    const reqCfg = REQUEST_TYPE_CONFIG[r.request_type as DeviceRequestType];
                    const priCfg = PRIORITY_CONFIG[(r.priority ?? "normal") as DeviceRequestPriority];
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border/30 hover:bg-muted/20 last:border-b-0"
                      >
                        <td className="py-2 px-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                              days > 7
                                ? "bg-rose-100 text-rose-700"
                                : days > 3
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-700",
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {days}д
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <p className="text-sm font-medium truncate">
                            {reqCfg?.emoji} {reqCfg?.label} —{" "}
                            {typeCfg?.label ?? r.device_type ?? "—"}
                          </p>
                          {r.purpose && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {r.purpose}
                            </p>
                          )}
                        </td>
                        <td className="py-2 px-3 text-sm text-muted-foreground truncate">
                          {r.creator?.name ?? "—"}
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant="outline"
                            className={cn("text-[11px]", priCfg.className)}
                          >
                            {priCfg.label}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-sm text-muted-foreground truncate">
                          {r.assignee?.name ?? (
                            <span className="text-amber-600 inline-flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Хуваариaгүй
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const days = ms / DAY_MS;
  if (days >= 1) return `${days.toFixed(1)} өдөр`;
  const hours = ms / HOUR_MS;
  if (hours >= 1) return `${hours.toFixed(1)} цаг`;
  const mins = ms / 60_000;
  return `${Math.max(1, Math.round(mins))} мин`;
}

const TILE_COLORS: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  indigo:  "bg-indigo-50 text-indigo-700 ring-indigo-100",
  rose:    "bg-rose-50 text-rose-700 ring-rose-100",
  amber:   "bg-amber-50 text-amber-700 ring-amber-100",
  slate:   "bg-slate-50 text-slate-700 ring-slate-100",
};

function KpiTile({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: keyof typeof TILE_COLORS;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-3">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1", TILE_COLORS[color])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-lg font-bold tabular-nums leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
