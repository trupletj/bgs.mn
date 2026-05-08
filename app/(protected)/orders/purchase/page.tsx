import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Package,
  User,
  Building2,
  Calendar,
  Clock,
  Hash,
  ArrowUpRight,
  ArrowDownUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPurchaseAllowedProcessIdsForCurrentUser } from "@/actions/order-process";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseOrder {
  id: number;
  order_number: string;
  title: string;
  status: "approved" | "changes_requested";
  order_type: string;
  order_process_id: number | null;
  created_at: string;
  requested_delivery_date?: string;
  profile?: { name?: string; department_name?: string } | null;
  order_items?: PurchaseOrderItem[];
}

type PurchaseOrderRow = Omit<PurchaseOrder, "profile"> & {
  profile?:
    | { name?: string; department_name?: string }
    | null
    | Array<{
        name?: string;
        department_name?: string;
      }>;
};

interface PurchaseOrderItem {
  id: number;
  quantity?: number | null;
  final_quantity?: number | null;
  order_fulfillment?: Array<{
    id: number;
    quantity?: number | null;
    status?: string | null;
  }>;
}

type PurchaseStatus = "not_ordered" | "ordering" | "completed";

type PurchaseOrderWithStatus = PurchaseOrder & {
  purchaseStatus: PurchaseStatus;
};

// ─── Configs ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  approved: {
    label: "Батлагдсан",
    icon: CheckCircle2,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    section: "Батлагдсан захиалгууд",
    sectionColor: "text-emerald-700",
    borderAccent: "border-l-emerald-400",
  },
  changes_requested: {
    label: "Өөрчлөлттэй батлагдсан",
    icon: AlertCircle,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-amber-400",
    section: "Өөрчлөлттэй батлагдсан захиалгууд",
    sectionColor: "text-amber-700",
    borderAccent: "border-l-amber-400",
  },
} as const;

const ORDER_TYPE: Record<string, { label: string; className: string }> = {
  emergency: {
    label: "Яаралтай",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  service: {
    label: "Үйлчилгээний",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  "major repairs": {
    label: "Их засвар",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  "safety reserves": {
    label: "Аюулгүйн нөөц",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  other: {
    label: "Бусад",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

const PURCHASE_STATUS: Record<
  PurchaseStatus,
  { label: string; className: string; rank: number }
> = {
  not_ordered: {
    label: "Захиалга хийгдээгүй",
    className: "bg-slate-100 text-slate-700 border-slate-200",
    rank: 1,
  },
  ordering: {
    label: "Захиалга хийгдэж байна",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    rank: 2,
  },
  completed: {
    label: "Захиалга хэрэгжсэн",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rank: 3,
  },
};

const COMPLETED_FULFILLMENT_STATUSES = new Set([
  "received",
  "completed",
  "done",
]);

function getPurchaseStatus(items: PurchaseOrderItem[] = []): PurchaseStatus {
  const hasAnyFulfillment = items.some(
    (item) => (item.order_fulfillment?.length ?? 0) > 0,
  );

  if (!hasAnyFulfillment) return "not_ordered";

  const allItemsCompleted =
    items.length > 0 &&
    items.every((item) => {
      const targetQuantity = Number(item.final_quantity ?? item.quantity ?? 0);
      if (targetQuantity <= 0) return true;

      const completedQuantity = (item.order_fulfillment ?? [])
        .filter((fulfillment) =>
          COMPLETED_FULFILLMENT_STATUSES.has(
            fulfillment.status?.toLowerCase() ?? "",
          ),
        )
        .reduce(
          (sum, fulfillment) => sum + Number(fulfillment.quantity ?? 0),
          0,
        );

      return completedQuantity >= targetQuantity;
    });

  return allItemsCompleted ? "completed" : "ordering";
}

function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  const cfg = PURCHASE_STATUS[status];
  return (
    <Badge variant="outline" className={cn("text-xs px-2 py-0", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

function formatDate(d?: string) {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OrderPurchasePage({
  searchParams,
}: {
  searchParams?: Promise<{ sort?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const sort = params?.sort ?? "created_desc";
  const { isSuperAdmin, processIds } =
    await getPurchaseAllowedProcessIdsForCurrentUser();

  if (!isSuperAdmin && processIds.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Захиалгын модуль
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Худалдан авалт
          </h1>
        </div>
        <EmptyState />
      </div>
    );
  }

  let query = supabase
    .from("orders")
    .select(
      `
      id, order_number, title, status, order_type, order_process_id,
      created_at, requested_delivery_date,
      profile:created_profile ( name, department_name ),
      order_items (
        id,
        quantity,
        final_quantity,
        order_fulfillment (
          id,
          quantity,
          status
        )
      )
    `,
    )
    .in("status", ["approved", "changes_requested"]);

  if (!isSuperAdmin) {
    query = query.in("order_process_id", processIds);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  const orders = ((data ?? []) as PurchaseOrderRow[]).map((row) => ({
    ...row,
    profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
    purchaseStatus: getPurchaseStatus(row.order_items),
  })) as PurchaseOrderWithStatus[];

  const sortedOrders = [...orders].sort((a, b) => {
    if (sort === "purchase_status_asc") {
      return (
        PURCHASE_STATUS[a.purchaseStatus].rank -
        PURCHASE_STATUS[b.purchaseStatus].rank
      );
    }
    if (sort === "purchase_status_desc") {
      return (
        PURCHASE_STATUS[b.purchaseStatus].rank -
        PURCHASE_STATUS[a.purchaseStatus].rank
      );
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const approved = orders.filter((o) => o.status === "approved");
  const changesRequested = orders.filter(
    (o) => o.status === "changes_requested",
  );
  const purchaseCounts = sortedOrders.reduce(
    (acc, order) => {
      acc[order.purchaseStatus] += 1;
      return acc;
    },
    { not_ordered: 0, ordering: 0, completed: 0 } as Record<
      PurchaseStatus,
      number
    >,
  );

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Захиалгын модуль
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Худалдан авалт
        </h1>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
          Өгөгдөл уншиж чадсангүй: {error.message}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Summary stats */}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[38rem]">
            {(Object.keys(PURCHASE_STATUS) as PurchaseStatus[]).map((key) => (
              <div
                key={key}
                className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  {PURCHASE_STATUS[key].label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {purchaseCounts[key]}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
              Эрэмбэлэх
            </div>
            <Button
              asChild
              variant={sort === "created_desc" ? "default" : "outline"}
              size="sm">
              <Link href="/orders/purchase">Огноогоор</Link>
            </Button>
            <Button
              asChild
              variant={sort === "purchase_status_asc" ? "default" : "outline"}
              size="sm">
              <Link href="/orders/purchase?sort=purchase_status_asc">
                Статус өсөх
              </Link>
            </Button>
            <Button
              asChild
              variant={sort === "purchase_status_desc" ? "default" : "outline"}
              size="sm">
              <Link href="/orders/purchase?sort=purchase_status_desc">
                Статус буурах
              </Link>
            </Button>
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ShoppingCart className="h-4 w-4" />
                Худалдан авалтын захиалгууд
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {sortedOrders.length}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex flex-col gap-2">
              {sortedOrders.map((order) => {
                const statusCfg = STATUS_CFG[order.status];
                const typeCfg =
                  ORDER_TYPE[order.order_type] ?? ORDER_TYPE.other;
                const createdDate = formatDate(order.created_at);
                const deliveryDate = formatDate(order.requested_delivery_date);
                return (
                  <div
                    key={order.id}
                    className={cn(
                      "group rounded-xl border border-border bg-card pl-4 transition-shadow hover:shadow-sm",
                      "border-l-[3px]",
                      statusCfg.borderAccent,
                    )}>
                    <div className="flex flex-col gap-3 py-4 pr-4 sm:flex-row sm:items-center">
                      <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary sm:flex">
                        <Package className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          {order.order_number && (
                            <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                              <Hash className="h-3 w-3" />
                              {order.order_number}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs px-2 py-0",
                              typeCfg.className,
                            )}>
                            {typeCfg.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs px-2 py-0",
                              statusCfg.badge,
                            )}>
                            {statusCfg.label}
                          </Badge>
                          <PurchaseStatusBadge status={order.purchaseStatus} />
                        </div>
                        <p className="font-semibold leading-snug text-foreground">
                          {order.title}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {order.profile?.name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3 shrink-0" />
                              {order.profile.name}
                            </span>
                          )}
                          {order.profile?.department_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 shrink-0" />
                              {order.profile.department_name}
                            </span>
                          )}
                          {createdDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              {createdDate}
                            </span>
                          )}
                          {deliveryDate && (
                            <span className="flex items-center gap-1 font-medium text-amber-600">
                              <Clock className="h-3 w-3 shrink-0" />
                              Хүргэлт: {deliveryDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1.5 self-start text-xs sm:self-auto">
                        <Link href={`/orders/${order.id}/imp`}>
                          Биелэлт
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <ShoppingCart className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <p className="font-semibold text-foreground">
        Худалдан авалтад бэлэн захиалга байхгүй
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Батлагдсан болон өөрчлөлттэй батлагдсан захиалгууд энд харагдана
      </p>
    </div>
  );
}
