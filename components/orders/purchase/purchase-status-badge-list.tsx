"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Factory,
  PackageCheck,
  Truck,
  Warehouse,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatQuantity, PURCHASE_MOVEMENT_LABELS } from "./utils";

export const PURCHASE_STATUS_ORDER = [
  "purchased",
  "at_warehouse",
  "in_delivery",
  "at_mine",
  "completed",
  "cancelled",
];

const STATUS_BADGE_CONFIG: Record<
  string,
  { icon: LucideIcon; className: string }
> = {
  purchased: {
    icon: PackageCheck,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  at_warehouse: {
    icon: Warehouse,
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  in_delivery: {
    icon: Truck,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  at_mine: {
    icon: Factory,
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  completed: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  cancelled: {
    icon: XCircle,
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

export type PurchaseStatusTotals = Record<string, number>;

export function PurchaseStatusBadgeList({
  statusTotals,
  emptyText = "Бүртгэл байхгүй",
}: {
  statusTotals: PurchaseStatusTotals;
  emptyText?: string;
}) {
  const visibleStatuses = PURCHASE_STATUS_ORDER.filter(
    (status) => (statusTotals[status] ?? 0) > 0,
  );

  if (visibleStatuses.length === 0) {
    return <span className="text-xs text-muted-foreground">{emptyText}</span>;
  }

  return (
    <div className="flex max-w-md flex-wrap gap-2">
      {visibleStatuses.map((status) => {
        const config = STATUS_BADGE_CONFIG[status];
        const Icon = config?.icon;

        return (
          <Badge
            key={status}
            variant="outline"
            className={cn(
              "gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold leading-none",
              config?.className,
            )}>
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{PURCHASE_MOVEMENT_LABELS[status] ?? status}</span>
            <span className="font-bold tabular-nums">
              {formatQuantity(statusTotals[status])}
            </span>
          </Badge>
        );
      })}
    </div>
  );
}
