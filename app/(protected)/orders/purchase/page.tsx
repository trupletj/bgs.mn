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
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseOrder {
  id: number;
  order_number: string;
  title: string;
  status: "approved" | "changes_requested";
  order_type: string;
  created_at: string;
  requested_delivery_date?: string;
  profile?: { name?: string; department_name?: string } | null;
}

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
  emergency:         { label: "Яаралтай",        className: "bg-red-50 text-red-700 border-red-200" },
  service:           { label: "Үйлчилгээний",    className: "bg-amber-50 text-amber-700 border-amber-200" },
  "major repairs":   { label: "Их засвар",        className: "bg-orange-50 text-orange-700 border-orange-200" },
  "safety reserves": { label: "Аюулгүйн нөөц",   className: "bg-green-50 text-green-700 border-green-200" },
  other:             { label: "Бусад",            className: "bg-slate-100 text-slate-600 border-slate-200" },
};

function formatDate(d?: string) {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OrderPurchasePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, title, status, order_type,
      created_at, requested_delivery_date,
      profile:created_profile ( name, department_name )
    `)
    .in("status", ["approved", "changes_requested"])
    .order("created_at", { ascending: false });

  const orders = ((data ?? []) as any[]).map((row) => ({
    ...row,
    profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
  })) as PurchaseOrder[];

  const approved          = orders.filter((o) => o.status === "approved");
  const changesRequested  = orders.filter((o) => o.status === "changes_requested");

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">

      {/* Header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Захиалгын модуль
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Худалдан авалт</h1>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:w-96">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="absolute left-0 top-0 h-0.5 w-full bg-emerald-500 opacity-60" />
              <p className="text-xs font-medium text-muted-foreground">Батлагдсан</p>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-3xl font-bold tabular-nums">{approved.length}</p>
                <div className="mb-0.5 rounded-lg bg-emerald-50 p-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="absolute left-0 top-0 h-0.5 w-full bg-amber-400 opacity-60" />
              <p className="text-xs font-medium text-muted-foreground">Өөрчлөлттэй батлагдсан</p>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-3xl font-bold tabular-nums">{changesRequested.length}</p>
                <div className="mb-0.5 rounded-lg bg-amber-50 p-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Sections */}
          {[
            { key: "approved" as const,          list: approved },
            { key: "changes_requested" as const, list: changesRequested },
          ].map(({ key, list }) => {
            if (list.length === 0) return null;
            const cfg = STATUS_CFG[key];
            const Icon = cfg.icon;
            return (
              <section key={key} className="space-y-3">
                {/* Section header */}
                <div className="flex items-center gap-2">
                  <div className={cn("flex items-center gap-1.5 text-sm font-semibold", cfg.sectionColor)}>
                    <Icon className="h-4 w-4" />
                    {cfg.section}
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {list.length}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Order cards */}
                <div className="flex flex-col gap-2">
                  {list.map((order) => {
                    const typeCfg = ORDER_TYPE[order.order_type] ?? ORDER_TYPE.other;
                    const createdDate = formatDate(order.created_at);
                    const deliveryDate = formatDate(order.requested_delivery_date);
                    return (
                      <div
                        key={order.id}
                        className={cn(
                          "group rounded-xl border border-border bg-card pl-4 transition-shadow hover:shadow-sm",
                          "border-l-[3px]",
                          cfg.borderAccent
                        )}
                      >
                        <div className="flex flex-col gap-3 py-4 pr-4 sm:flex-row sm:items-center">
                          {/* Icon */}
                          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary sm:flex">
                            <Package className="h-4 w-4" />
                          </div>

                          {/* Main info */}
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              {order.order_number && (
                                <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                                  <Hash className="h-3 w-3" />
                                  {order.order_number}
                                </span>
                              )}
                              <Badge variant="outline" className={cn("text-xs px-2 py-0", typeCfg.className)}>
                                {typeCfg.label}
                              </Badge>
                              <Badge variant="outline" className={cn("text-xs px-2 py-0", cfg.badge)}>
                                {cfg.label}
                              </Badge>
                            </div>
                            <p className="font-semibold leading-snug text-foreground">{order.title}</p>
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

                          {/* Action */}
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 gap-1.5 self-start text-xs sm:self-auto"
                          >
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
            );
          })}
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
      <p className="font-semibold text-foreground">Худалдан авалтад бэлэн захиалга байхгүй</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Батлагдсан болон өөрчлөлттэй батлагдсан захиалгууд энд харагдана
      </p>
    </div>
  );
}
