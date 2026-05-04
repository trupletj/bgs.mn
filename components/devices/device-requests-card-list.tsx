"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEVICE_TYPE_CONFIG, type DeviceType } from "@/types/device";
import {
  REQUEST_TYPE_CONFIG, PRIORITY_CONFIG, getDeviceTypeIcon,
} from "@/components/devices/request-shared";
import { DeviceRequestActions } from "@/components/devices/device-request-actions";
import type {
  DeviceRequestType, DeviceRequestPriority, DeviceRequestStatus,
} from "@/actions/devices";
import {
  Pencil, Calendar, Building2, User as UserIcon,
  ChevronDown, ChevronRight, Link2, Unplug, AlertCircle,
} from "lucide-react";

const STATUS_CONFIG: Record<DeviceRequestStatus, { label: string; className: string; dot: string }> = {
  pending:  { label: "Хүлээгдэж буй", className: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-500" },
  approved: { label: "Зөвшөөрсөн",     className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  rejected: { label: "Татгалзсан",     className: "bg-rose-50 text-rose-700 border-rose-200",         dot: "bg-rose-500" },
};

const CHILD_TYPE_META: Record<string, { label: string; emoji: string; color: string }> = {
  monitor:      { label: "Дэлгэц захиалсан",  emoji: "🖥",  color: "indigo" },
  transfer:     { label: "Хуучин шилжүүлэх",  emoji: "↗",  color: "emerald" },
  decommission: { label: "Хуучин актлах",     emoji: "🗑",  color: "rose" },
  repair:       { label: "Хуучин засварт",    emoji: "🔧", color: "amber" },
};

const CHILD_COLOR_BG: Record<string, string> = {
  indigo:  "bg-indigo-50 text-indigo-700 border-indigo-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose:    "bg-rose-50 text-rose-700 border-rose-200",
  amber:   "bg-amber-50 text-amber-700 border-amber-200",
};

interface RequestGroup {
  parent: any;
  children: any[];
}

interface NameLookups {
  orgByBteg: Record<string, string>;
  heltesByBteg: Record<string, string>;
  albaByBteg: Record<string, string>;
  parentLookup?: Map<string, any>;
}

export interface DeviceRequestsCardListProps {
  groups: RequestGroup[];
  orphanChildren: any[];
  lookups: NameLookups;
  pageSize?: number;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function childKindOf(c: any): keyof typeof CHILD_TYPE_META | null {
  if (c.device_type === "monitor")      return "monitor";
  if (c.request_type === "transfer")     return "transfer";
  if (c.request_type === "decommission") return "decommission";
  if (c.request_type === "repair")       return "repair";
  return null;
}

export function DeviceRequestsCardList({
  groups, orphanChildren, lookups, pageSize = 10,
}: DeviceRequestsCardListProps) {
  const [page, setPage] = useState(0);
  const totalCards = groups.length + orphanChildren.length;
  const totalPages = Math.max(1, Math.ceil(totalCards / pageSize));

  // Pagination — group-аар. Эхлээд groups, дараа нь orphans нэмж нэг массивт буулгана.
  const allItems = useMemo(() => {
    return [
      ...groups.map((g) => ({ kind: "group" as const, group: g })),
      ...orphanChildren.map((c) => ({ kind: "orphan" as const, request: c })),
    ];
  }, [groups, orphanChildren]);

  const pageItems = allItems.slice(page * pageSize, (page + 1) * pageSize);

  if (totalCards === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/10 py-12 text-center">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Хүсэлт олдсонгүй</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {pageItems.map((item, i) =>
        item.kind === "group" ? (
          <RequestGroupCard
            key={`g-${item.group.parent.id}`}
            group={item.group}
            lookups={lookups}
          />
        ) : (
          <OrphanChildCard
            key={`o-${item.request.id}`}
            request={item.request}
            lookups={lookups}
          />
        ),
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCards)} / {totalCards}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              Өмнөх
            </Button>
            <span className="px-2 text-xs font-medium tabular-nums text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Дараах
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Group card (parent + children)
// ═══════════════════════════════════════════════════════════════════════════

function RequestGroupCard({
  group, lookups,
}: {
  group: RequestGroup;
  lookups: NameLookups;
}) {
  const { parent, children } = group;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors">
      <PrimaryRow request={parent} lookups={lookups} hasChildren={children.length > 0} />

      {children.length > 0 && (
        <div className="border-t border-border/60 bg-muted/20">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Холбоотой хүсэлтүүд ({children.length})
            </span>
            <ChildSummaryChips children={children} />
          </button>

          {expanded && (
            <div className="space-y-1.5 p-2 pt-0">
              {children.map((c) => (
                <ChildRow key={c.id} request={c} lookups={lookups} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Primary row (parent or standalone)
// ═══════════════════════════════════════════════════════════════════════════

function PrimaryRow({
  request, lookups, hasChildren,
}: {
  request: any;
  lookups: NameLookups;
  hasChildren?: boolean;
}) {
  const router = useRouter();
  const TypeIcon = getDeviceTypeIcon(request.device_type);
  const typeCfg = DEVICE_TYPE_CONFIG[request.device_type as DeviceType];
  const reqCfg = REQUEST_TYPE_CONFIG[request.request_type as DeviceRequestType];
  const statusCfg = STATUS_CONFIG[request.status as DeviceRequestStatus] ?? STATUS_CONFIG.pending;
  const priCfg = PRIORITY_CONFIG[(request.priority ?? "normal") as DeviceRequestPriority];

  const orgName    = lookups.orgByBteg[request.req_org_bteg];
  const heltesName = lookups.heltesByBteg[request.req_heltes_bteg];
  const albaName   = lookups.albaByBteg[request.req_alba_bteg];

  return (
    <div className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-start sm:gap-4">
      {/* Icon */}
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <TypeIcon className="h-5 w-5" />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold truncate">
            {typeCfg?.label ?? request.device_type ?? "—"}
          </h3>
          <Badge
            variant="outline"
            className={cn("text-[11px] font-medium", reqCfg?.className)}
          >
            {reqCfg?.emoji} {reqCfg?.label ?? request.request_type}
          </Badge>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
            <Calendar className="h-3 w-3" />
            {formatDate(request.created_at)}
          </span>
        </div>

        {/* Creator + dept */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserIcon className="h-3 w-3" />
            <span className="font-medium text-foreground">{request.creator?.name ?? "—"}</span>
          </span>
          {(orgName || heltesName) && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {[orgName, heltesName, albaName].filter(Boolean).join(" / ")}
            </span>
          )}
        </div>

        {/* Purpose */}
        {request.purpose && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
            «{request.purpose}»
          </p>
        )}

        {/* Notes (decommission reason / repair description) */}
        {request.notes && (
          <p className="mt-1 text-[11px] italic text-muted-foreground/80 line-clamp-1">
            {request.notes}
          </p>
        )}

        {/* Admin notes (rejection / approval reason) */}
        {request.admin_notes && (
          <p className={cn(
            "mt-1.5 inline-block rounded-md px-2 py-1 text-[11px]",
            request.status === "rejected"
              ? "bg-rose-50 text-rose-700"
              : "bg-emerald-50 text-emerald-700",
          )}>
            {request.status === "rejected" ? "Татгалзсан шалтгаан: " : "Тэмдэглэл: "}
            {request.admin_notes}
          </p>
        )}
      </div>

      {/* Right column: badges + actions */}
      <div className="flex items-start gap-2 sm:flex-col sm:items-end shrink-0">
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", statusCfg.dot)} />
            <Badge variant="outline" className={cn("text-[11px]", statusCfg.className)}>
              {statusCfg.label}
            </Badge>
          </div>
          <Badge variant="outline" className={cn("text-[11px]", priCfg.className)}>
            {priCfg.label}
          </Badge>
          {request.assignee?.name && (
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              {request.assignee.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => router.push(`/devices/requests/${request.id}/edit`)}
            title="Засах"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-600 hover:border-blue-600 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {request.status === "pending" && <DeviceRequestActions requestId={request.id} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Child row (compact, indented)
// ═══════════════════════════════════════════════════════════════════════════

function ChildRow({
  request, lookups,
}: {
  request: any;
  lookups: NameLookups;
}) {
  const router = useRouter();
  const TypeIcon = getDeviceTypeIcon(request.device_type);
  const typeCfg = DEVICE_TYPE_CONFIG[request.device_type as DeviceType];
  const statusCfg = STATUS_CONFIG[request.status as DeviceRequestStatus] ?? STATUS_CONFIG.pending;

  const kind = childKindOf(request);
  const meta = kind ? CHILD_TYPE_META[kind] : null;
  const colorCls = meta ? CHILD_COLOR_BG[meta.color] : "bg-slate-50 text-slate-700 border-slate-200";

  // Дэлгэцийн specs хураангуй
  const specsSummary = (() => {
    if (!request.specs) return null;
    if (request.device_type === "monitor") {
      const s = request.specs;
      return [s.size_inch ? `${s.size_inch}"` : null, s.resolution, s.panel_type].filter(Boolean).join(" · ");
    }
    return null;
  })();

  // Шилжүүлэх destination
  const destSummary = (() => {
    if (request.request_type !== "transfer") return null;
    const o = lookups.orgByBteg[request.transfer_to_org_bteg];
    const h = lookups.heltesByBteg[request.transfer_to_heltes_bteg];
    const a = lookups.albaByBteg[request.transfer_to_alba_bteg];
    const dest = [o, h, a].filter(Boolean).join(" / ");
    return dest || "Хүлээн авах нэгж тодорхойгүй";
  })();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
      {/* Connector + icon */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Link2 className="h-3 w-3 text-muted-foreground/50" />
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <TypeIcon className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {meta && (
            <Badge variant="outline" className={cn("text-[10px] font-medium border", colorCls)}>
              {meta.emoji} {meta.label}
            </Badge>
          )}
          <span className="text-xs font-medium truncate">
            {typeCfg?.label ?? request.device_type ?? "—"}
          </span>
          {specsSummary && (
            <span className="text-[11px] text-muted-foreground">· {specsSummary}</span>
          )}
        </div>
        {(destSummary || request.notes) && (
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
            {destSummary || request.notes}
          </p>
        )}
      </div>

      {/* Status + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={cn("text-[10px]", statusCfg.className)}>
          {statusCfg.label}
        </Badge>
        <button
          type="button"
          onClick={() => router.push(`/devices/requests/${request.id}/edit`)}
          title="Засах"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-600 hover:border-blue-600 hover:text-white"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Orphan child (parent шүүлтэд орохгүй child)
// ═══════════════════════════════════════════════════════════════════════════

function OrphanChildCard({
  request, lookups,
}: {
  request: any;
  lookups: NameLookups;
}) {
  const parent = lookups.parentLookup?.get(request.parent_request_id);

  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/30 overflow-hidden">
      {parent ? (
        <ParentSummaryBanner parent={parent} />
      ) : (
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-1.5 text-[11px] text-amber-700">
          <Unplug className="h-3 w-3" />
          Эх хүсэлт олдсонгүй
        </div>
      )}
      <PrimaryRow request={request} lookups={lookups} />
    </div>
  );
}

function ParentSummaryBanner({ parent }: { parent: any }) {
  const router = useRouter();
  const TypeIcon = getDeviceTypeIcon(parent.device_type);
  const typeLabel = DEVICE_TYPE_CONFIG[parent.device_type as DeviceType]?.label ?? parent.device_type ?? "—";
  const reqCfg = REQUEST_TYPE_CONFIG[parent.request_type as DeviceRequestType];
  const statusCfg = STATUS_CONFIG[parent.status as DeviceRequestStatus] ?? STATUS_CONFIG.pending;

  return (
    <div className="flex flex-wrap items-center gap-2 bg-amber-50 px-3 py-2 border-b border-amber-200">
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 shrink-0">
        <Unplug className="h-3 w-3" />
        Эх хүсэлтэд хамаарна:
      </span>
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-amber-100 text-amber-700">
        <TypeIcon className="h-3.5 w-3.5" />
      </div>
      <span className="text-xs font-medium text-foreground truncate min-w-0">{typeLabel}</span>
      {reqCfg && (
        <Badge
          variant="outline"
          className={cn("text-[10px]", reqCfg.className)}
        >
          {reqCfg.emoji} {reqCfg.label}
        </Badge>
      )}
      <Badge
        variant="outline"
        className={cn("text-[10px]", statusCfg.className)}
      >
        {statusCfg.label}
      </Badge>
      {parent.creator?.name && (
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 truncate min-w-0">
          <UserIcon className="h-3 w-3" />
          {parent.creator.name}
        </span>
      )}
      <span className="ml-auto text-[11px] text-muted-foreground tabular-nums shrink-0">
        {formatDate(parent.created_at)}
      </span>
      <button
        type="button"
        onClick={() => router.push(`/devices/requests/${parent.id}/edit`)}
        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 transition-colors shrink-0"
      >
        <Link2 className="h-3 w-3" />
        Нээх
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Child summary chips (header section)
// ═══════════════════════════════════════════════════════════════════════════

function ChildSummaryChips({ children }: { children: any[] }) {
  const counts: Record<string, number> = {};
  for (const c of children) {
    const kind = childKindOf(c);
    if (!kind) continue;
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {entries.map(([kind, n]) => {
        const meta = CHILD_TYPE_META[kind];
        const cls = CHILD_COLOR_BG[meta?.color] ?? "bg-slate-50 text-slate-700";
        return (
          <span
            key={kind}
            className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium border", cls)}
          >
            {meta?.emoji} {n}
          </span>
        );
      })}
    </div>
  );
}
