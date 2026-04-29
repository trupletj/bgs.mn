"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAwaitingOrders, AwaitingOrder } from "@/actions/orders";
import {
  Clock,
  User,
  Building2,
  Calendar,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  ExternalLink,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Configs ──────────────────────────────────────────────────────────────────

const ORDER_TYPE: Record<string, { label: string; className: string }> = {
  emergency:        { label: "Яаралтай",        className: "bg-red-50 text-red-700 border-red-200" },
  service:          { label: "Үйлчилгээний",    className: "bg-amber-50 text-amber-700 border-amber-200" },
  "major repairs":  { label: "Их засвар",        className: "bg-orange-50 text-orange-700 border-orange-200" },
  "safety reserves":{ label: "Аюулгүйн нөөц",   className: "bg-green-50 text-green-700 border-green-200" },
  other:            { label: "Бусад",            className: "bg-slate-100 text-slate-600 border-slate-200" },
};

const REVIEW_STATUS: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  approved:          { label: "Зөвшөөрсөн",      icon: <CheckCircle2 className="h-3 w-3" />, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:          { label: "Татгалзсан",       icon: <XCircle className="h-3 w-3" />,      className: "bg-red-50 text-red-700 border-red-200" },
  changes_requested: { label: "Өөрчлөлт шаардсан", icon: <AlertCircle className="h-3 w-3" />, className: "bg-violet-50 text-violet-700 border-violet-200" },
  skipped:           { label: "Алгассан",         icon: <Clock className="h-3 w-3" />,        className: "bg-slate-100 text-slate-500 border-slate-200" },
};

function formatDate(d?: string) {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

// ─── Helper to normalise the dual shape of AwaitingOrder ─────────────────────

function parseAwaiting(r: AwaitingOrder) {
  const instance = (r.order_instances ?? r.order_instance) as any;
  if (!instance) return null;
  const order = instance.orders ?? instance.order;
  if (!order) return null;
  const profile = order.profile ?? order.created_profile ?? null;
  return { instance, order, profile };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  profile_id: string;
  type: "pending" | "reviewed";
  initialData: AwaitingOrder[] | null;
}

export function RequestedList({ profile_id, type, initialData }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<AwaitingOrder[]>(initialData ?? []);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await getAwaitingOrders(profile_id);
      const filtered = (data ?? []).filter((r) =>
        type === "pending"
          ? r.status === "pending" || !r.status
          : r.status && r.status !== "pending"
      );
      setItems(filtered);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ListSkeleton />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          {type === "pending"
            ? <Clock className="h-5 w-5 text-muted-foreground/40" />
            : <CheckCircle2 className="h-5 w-5 text-muted-foreground/40" />}
        </div>
        <p className="font-medium text-foreground">
          {type === "pending" ? "Хянах захиалга байхгүй" : "Хянасан захиалга байхгүй"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {type === "pending"
            ? "Одоогоор танд хянах шаардлагатай захиалга байхгүй байна"
            : "Та одоогоор ямар нэгэн захиалга хянаагүй байна"}
        </p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={refresh}>
          Шинэчлэх
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((r) => {
        const parsed = parseAwaiting(r);
        if (!parsed) return null;
        const { instance, order, profile } = parsed;
        const typeKey = order.urgency_level || order.order_type || "other";
        const typeCfg = ORDER_TYPE[typeKey] ?? ORDER_TYPE.other;
        const reviewCfg = REVIEW_STATUS[r.status] ?? null;
        const createdDate = formatDate(r.created_at);
        const deliveryDate = formatDate(order.requested_delivery_date);

        return (
          <div
            key={r.id}
            className={cn(
              "group relative rounded-xl border bg-card transition-shadow hover:shadow-sm",
              type === "pending" ? "border-border" : "border-border/60"
            )}
          >
            {/* Left accent for pending */}
            {type === "pending" && (
              <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-primary/60" />
            )}

            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
              {/* ── Main info ── */}
              <div className="min-w-0 flex-1">
                {/* Badges row */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {order.order_number && (
                    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <Hash className="h-3 w-3" />
                      {order.order_number}
                    </span>
                  )}
                  <Badge variant="outline" className={cn("text-xs px-2 py-0", typeCfg.className)}>
                    {typeCfg.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs px-2 py-0 bg-blue-50 text-blue-700 border-blue-200">
                    {instance.current_step_order}-р шат
                  </Badge>
                  {type === "reviewed" && reviewCfg && (
                    <Badge variant="outline" className={cn("flex items-center gap-1 text-xs px-2 py-0", reviewCfg.className)}>
                      {reviewCfg.icon}
                      {reviewCfg.label}
                    </Badge>
                  )}
                </div>

                {/* Title */}
                <p className="font-semibold leading-snug text-foreground">
                  {order.title || "Гарчиггүй захиалга"}
                </p>

                {/* Meta row */}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {profile?.name && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3 shrink-0" />
                      {profile.name}
                    </span>
                  )}
                  {profile?.department_name && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {profile.department_name}
                    </span>
                  )}
                  {createdDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {createdDate}
                    </span>
                  )}
                  {deliveryDate && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock className="h-3 w-3 shrink-0" />
                      Хүргэлт: {deliveryDate}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-end">
                {type === "pending" ? (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => router.push(`/orders/${order.id}/rate`)}
                  >
                    Шалгах
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
                    {reviewCfg?.icon}
                    <span>Шалгасан</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  asChild
                >
                  <Link href={`/orders/${order.id}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    Дэлгэрэнгүй
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-5 w-2/3" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
