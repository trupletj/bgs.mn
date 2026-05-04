"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DEVICE_TYPE_CONFIG, type DeviceType } from "@/types/device";
import { REQUEST_TYPE_CONFIG } from "@/components/devices/request-shared";
import type { DeviceRequestStatus } from "@/actions/devices";
import {
  GitBranch, Monitor, ArrowRightLeft, Trash2, Wrench, Link2,
  RefreshCw as RefreshIcon, AlertCircle,
} from "lucide-react";

interface Props {
  requests: any[];
}

const ACTION_META = [
  { key: "transfer",     label: "Шилжүүлэх",  icon: ArrowRightLeft, color: "emerald" },
  { key: "decommission", label: "Актлах",      icon: Trash2,         color: "rose" },
  { key: "repair",       label: "Засвар",      icon: Wrench,         color: "amber" },
] as const;

const STATUS_COLORS: Record<DeviceRequestStatus, string> = {
  pending:  "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

const STATUS_LABELS: Record<DeviceRequestStatus, string> = {
  pending: "Хүлээгдэж буй",
  approved: "Зөвшөөрсөн",
  rejected: "Татгалзсан",
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; ring: string; bar: string }> = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-100", bar: "bg-emerald-500" },
  rose:    { bg: "bg-rose-50",    text: "text-rose-700",    ring: "ring-rose-100",    bar: "bg-rose-500" },
  amber:   { bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-100",   bar: "bg-amber-500" },
  indigo:  { bg: "bg-indigo-50",  text: "text-indigo-700",  ring: "ring-indigo-100",  bar: "bg-indigo-500" },
  cyan:    { bg: "bg-cyan-50",    text: "text-cyan-700",    ring: "ring-cyan-100",    bar: "bg-cyan-500" },
};

export function RequestLinkedAnalytics({ requests }: Props) {
  // ── Replace request анализ ──
  const stats = useMemo(() => {
    const replaceRequests = requests.filter((r) => r.request_type === "replace");
    const replaceTotal = replaceRequests.length;
    const replaceIds = new Set(replaceRequests.map((r) => r.id));

    // Replace бүрд ямар child action-уудтай вэ
    const childrenByParent = new Map<
      string,
      { transfer: number; decommission: number; repair: number; monitor: number }
    >();
    for (const r of requests) {
      if (!r.parent_request_id) continue;
      if (!replaceIds.has(r.parent_request_id)) continue;
      const cur = childrenByParent.get(r.parent_request_id) ?? {
        transfer: 0, decommission: 0, repair: 0, monitor: 0,
      };
      if (r.request_type === "transfer")     cur.transfer += 1;
      if (r.request_type === "decommission") cur.decommission += 1;
      if (r.request_type === "repair")       cur.repair += 1;
      if (r.device_type  === "monitor")      cur.monitor += 1;
      childrenByParent.set(r.parent_request_id, cur);
    }

    let withTransfer = 0, withDecom = 0, withRepair = 0, withMonitor = 0;
    let withAnyOldAction = 0, withAnyChild = 0;
    let standalone = 0;
    for (const r of replaceRequests) {
      const c = childrenByParent.get(r.id);
      if (!c) { standalone += 1; continue; }
      const hasOldAction = c.transfer > 0 || c.decommission > 0 || c.repair > 0;
      const hasMon = c.monitor > 0;
      if (hasOldAction || hasMon) withAnyChild += 1;
      if (hasOldAction) withAnyOldAction += 1;
      else if (!hasMon) standalone += 1;
      if (c.transfer > 0)     withTransfer += 1;
      if (c.decommission > 0) withDecom += 1;
      if (c.repair > 0)       withRepair += 1;
      if (c.monitor > 0)      withMonitor += 1;
    }

    // Replace requests with NO old-device action and old_device_id present (potentially missed)
    const linkable = replaceRequests.filter((r) => {
      const c = childrenByParent.get(r.id);
      const hasOldAction = c ? (c.transfer + c.decommission + c.repair) > 0 : false;
      return r.old_device_id && !hasOldAction;
    });

    return {
      replaceTotal,
      withTransfer,
      withDecom,
      withRepair,
      withMonitor,
      withAnyOldAction,
      withAnyChild,
      standalone,
      linkable,
    };
  }, [requests]);

  // ── Бүх parent-child orphan check (parent устсан child) ──
  const orphans = useMemo(() => {
    const ids = new Set(requests.map((r) => r.id));
    return requests.filter((r) => r.parent_request_id && !ids.has(r.parent_request_id));
  }, [requests]);

  const pct = (n: number) => stats.replaceTotal > 0 ? Math.round((n / stats.replaceTotal) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">Хосолсон хүсэлтийн анализ</h2>
            <p className="text-xs text-muted-foreground">
              Шинэчлэх хүсэлт ямар тусдаа хүсэлт автоматаар үүсгэснийг харуулна
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {stats.replaceTotal === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Шинэчлэх хүсэлт байхгүй байна
          </div>
        ) : (
          <>
            {/* Replace KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Tile
                icon={RefreshIcon}
                label="Нийт шинэчлэх"
                value={stats.replaceTotal}
                color="cyan"
              />
              <Tile
                icon={Link2}
                label="Хосолсон"
                value={stats.withAnyChild}
                sub={`${pct(stats.withAnyChild)}% replace`}
                color="indigo"
              />
              <Tile
                icon={GitBranch}
                label="Хуучин дээр үйлдэлтэй"
                value={stats.withAnyOldAction}
                sub={`${pct(stats.withAnyOldAction)}% replace`}
                color="emerald"
              />
              <Tile
                icon={AlertCircle}
                label="Үйлдэлгүй үлдсэн"
                value={stats.linkable.length}
                sub="Хуучин device-тэй ч action үгүй"
                color={stats.linkable.length > 0 ? "amber" : "rose"}
              />
            </div>

            {/* Хувийн харьцаа horizontal stacked-маягийн progress */}
            <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">
                  Шинэчлэх хүсэлтийн action-ийн харьцаа
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.replaceTotal} replace хүсэлтээс
                </p>
              </div>

              {/* Monitor */}
              <ActionRow
                icon={Monitor}
                label="Дэлгэц хамт захиалсан"
                count={stats.withMonitor}
                total={stats.replaceTotal}
                color="indigo"
              />
              {/* Transfer */}
              <ActionRow
                icon={ArrowRightLeft}
                label="Хуучин төхөөрөмжийг шилжүүлэх"
                count={stats.withTransfer}
                total={stats.replaceTotal}
                color="emerald"
              />
              {/* Decommission */}
              <ActionRow
                icon={Trash2}
                label="Хуучин төхөөрөмжийг актлах"
                count={stats.withDecom}
                total={stats.replaceTotal}
                color="rose"
              />
              {/* Repair */}
              <ActionRow
                icon={Wrench}
                label="Хуучин төхөөрөмжийг засварт явуулах"
                count={stats.withRepair}
                total={stats.replaceTotal}
                color="amber"
              />
            </div>

            {/* Үйлдэлгүй үлдсэн replace хүсэлтүүдийн жагсаалт */}
            {stats.linkable.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    <p className="text-xs font-semibold">
                      Хуучин төхөөрөмж дээр action үүсгээгүй replace хүсэлтүүд
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Top {Math.min(8, stats.linkable.length)} ({stats.linkable.length} нийт)
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
                        <th className="text-left py-2 px-3 font-medium">Хүсэлт</th>
                        <th className="text-left py-2 px-3 font-medium">Хуучин төхөөрөмж</th>
                        <th className="text-left py-2 px-3 font-medium">Гаргагч</th>
                        <th className="text-left py-2 px-3 font-medium w-24">Төлөв</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.linkable.slice(0, 8).map((r) => {
                        const typeCfg = DEVICE_TYPE_CONFIG[r.device_type as DeviceType];
                        return (
                          <tr
                            key={r.id}
                            className="border-b border-border/30 hover:bg-muted/20 last:border-b-0"
                          >
                            <td className="py-2 px-3">
                              <p className="text-sm font-medium truncate">
                                Шинэчлэх — {typeCfg?.label ?? r.device_type ?? "—"}
                              </p>
                              {r.purpose && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {r.purpose}
                                </p>
                              )}
                            </td>
                            <td className="py-2 px-3 text-sm text-muted-foreground truncate">
                              {r.old_device?.name ?? "—"}
                              {r.old_device?.serial_number && (
                                <span className="ml-1 text-[11px] opacity-70">
                                  · {r.old_device.serial_number}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-sm text-muted-foreground truncate">
                              {r.creator?.name ?? "—"}
                            </td>
                            <td className="py-2 px-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[11px]",
                                  STATUS_COLORS[r.status as DeviceRequestStatus],
                                )}
                              >
                                {STATUS_LABELS[r.status as DeviceRequestStatus]}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {stats.linkable.length > 8 && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground text-right">
                    + {stats.linkable.length - 8} илүү
                  </p>
                )}
              </div>
            )}

            {/* Orphan warning */}
            {orphans.length > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>
                  <strong>{orphans.length}</strong> child хүсэлт нь parent-аа
                  устгасан байна. Цэгцлэх шаардлагатай.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function ActionRow({
  icon: Icon, label, count, total, color,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  total: number;
  color: keyof typeof COLOR_CLASSES;
}) {
  const percent = total > 0 ? (count / total) * 100 : 0;
  const cc = COLOR_CLASSES[color];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", cc.bg, cc.text)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-sm">
          <span className="font-bold tabular-nums">{count}</span>
          <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
            {percent.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", cc.bar)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Tile({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: keyof typeof COLOR_CLASSES;
}) {
  const cc = COLOR_CLASSES[color];
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-3">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1", cc.bg, cc.text, cc.ring)}>
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
