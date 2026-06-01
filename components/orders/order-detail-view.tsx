"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Calendar,
  Clock,
  Building2,
  Phone,
  Briefcase,
  Package,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ImageViewer from "@/components/image-viewer";
import { OrderWorkflow } from "./order-workflow";
import { getSparePartLabel, UNIT_OPTIONS } from "@/types/types";
import { cn } from "@/lib/utils";
import { OrderPurchaseSummaryPanel } from "@/components/orders/purchase/order-purchase-summary-panel";

// ─── Status / type configs ───────────────────────────────────────────────────

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Шинэ",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  in_progress: {
    label: "Процесс-д",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  created_step: {
    label: "Хянагдаж байна",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  approved: {
    label: "Батлагдсан",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  changes_requested: {
    label: "Өөрчлөлттэй батлагдсан",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "Татгалзсан",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

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

function StatusBadge({ status }: { status: string }) {
  const cfg = ORDER_STATUS[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <Badge
      variant="outline"
      className={cn("px-3 py-1 text-sm font-medium", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cfg = ORDER_TYPE[type] ?? ORDER_TYPE.other;
  return (
    <Badge
      variant="outline"
      className={cn("px-2 py-0.5 text-xs font-medium", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

function formatDate(dateString?: string | null) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Props ───────────────────────────────────────────────────────────────────

type WorkflowReviewers = ComponentProps<typeof OrderWorkflow>["reviewers"];

interface OrderDetailItem {
  id: number | string;
  part_name: string;
  part_number?: string | null;
  quantity: number;
  final_quantity?: number | null;
  unit: string;
  spare_type: string;
  image_url?: string | null;
}

interface OrderDetail {
  order: {
    id?: number | string;
    order_number: string;
    order_type: string;
    title: string;
    status: string;
    description?: string | null;
    created_at?: string;
    requested_delivery_date?: string | null;
    notes?: string | null;
  };
  profile: {
    name?: string | null;
    position_name?: string | null;
    department_name?: string | null;
    phone?: string | null;
  };
  items: OrderDetailItem[];
  reviewers: unknown[];
  instance?: {
    current_step_order?: number | string | null;
  } | null;
}

interface Props {
  orderDetails: OrderDetail;
  canViewPrices?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NewOrderDetailView({
  orderDetails,
  canViewPrices = false,
}: Props) {
  const { order, profile, items, reviewers } = orderDetails;

  const isSettled =
    order.status === "approved" || order.status === "changes_requested";

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* ── Back + header ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-sm  transition-colors hover:text-foreground w-fit">
          <ArrowLeft className="h-4 w-4" />
          Жагсаалт руу буцах
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs ">
              {/* <span className="font-mono">{order.order_number}</span> */}
            </div>
            <h1 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight text-foreground">
              {order.title}
            </h1>
          </div>
          <div className="shrink-0">
            <StatusBadge status={order.status} />
          </div>
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Order info */}
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
              <FileText className="h-4 w-4 " />
              <h2 className="text-sm font-semibold">Захиалгын мэдээлэл</h2>
            </div>
            <div className="p-5 space-y-4">
              {order.description && (
                <p className="text-sm leading-relaxed">{order.description}</p>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <InfoRow
                  icon={Calendar}
                  label="Үүсгэсэн"
                  value={formatDate(order.created_at)}
                />
                <InfoRow
                  icon={Clock}
                  label="Шаардлагатай огноо"
                  value={formatDate(order.requested_delivery_date)}
                />
                <TypeBadge type={order.order_type} />

                {order.notes && (
                  <div className="col-span-2 sm:col-span-3">
                    <InfoRow
                      icon={AlertTriangle}
                      label="Тэмдэглэл"
                      value={order.notes}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Items */}
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Сэлбэгүүд</h2>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {items.length}
              </span>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 text-left">Нэр / Дугаар</th>
                    <th className="px-4 py-3 text-left">Төрөл</th>
                    <th className="px-4 py-3 text-right">Тоо хэмжээ</th>
                    {isSettled && (
                      <th className="px-4 py-3 text-right">Батлагдсан тоо</th>
                    )}
                    <th className="px-5 py-3 text-center">Зураг</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {items.map((item) => {
                    const unit =
                      UNIT_OPTIONS.find((u) => u.value === item.unit)?.label ??
                      item.unit;
                    const changed =
                      isSettled &&
                      item.final_quantity !== null &&
                      item.final_quantity !== item.quantity;
                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-muted/20">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground">
                            {item.part_name}
                          </p>
                          {item.part_number && (
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                              {item.part_number}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">
                          {getSparePartLabel(item.spare_type)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span
                            className={cn(
                              "font-mono font-medium",
                              changed
                                ? "text-muted-foreground line-through"
                                : "text-foreground",
                            )}>
                            {item.quantity}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            {unit}
                          </span>
                        </td>
                        {isSettled && (
                          <td className="px-4 py-3.5 text-right">
                            {item.final_quantity !== null ? (
                              <span
                                className={cn(
                                  "font-mono font-semibold",
                                  changed
                                    ? "text-violet-700"
                                    : "text-emerald-700",
                                )}>
                                {item.final_quantity}
                                <span className="ml-1 text-xs font-normal">
                                  {unit}
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-5 py-3.5">
                          <div className="flex justify-center ">
                            {item.image_url ? (
                              <ImageViewer images={[item.image_url]} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col divide-y divide-border/40 sm:hidden">
              {items.map((item) => {
                const unit =
                  UNIT_OPTIONS.find((u) => u.value === item.unit)?.label ??
                  item.unit;
                const changed =
                  isSettled &&
                  item.final_quantity !== null &&
                  item.final_quantity !== item.quantity;
                return (
                  <div key={item.id} className="flex gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        {item.part_name}
                      </p>
                      {item.part_number && (
                        <p className="font-mono text-xs ">{item.part_number}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-2 text-xs ">
                        <span>{getSparePartLabel(item.spare_type)}</span>
                        <span>·</span>
                        <span className={changed ? "line-through" : ""}>
                          {item.quantity} {unit}
                        </span>
                        {isSettled && item.final_quantity !== null && (
                          <span
                            className={
                              changed
                                ? "font-semibold text-violet-700"
                                : "text-emerald-700"
                            }>
                            → {item.final_quantity} {unit}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.image_url && (
                      <div className="shrink-0">
                        <ImageViewer images={[item.image_url]} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {order.id && (
            <OrderPurchaseSummaryPanel
              orderId={order.id}
              items={items}
              canViewPrices={canViewPrices}
            />
          )}
        </div>

        {/* ── Right sidebar ────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Requester */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 " />
              Хүсэлт гаргагч
            </h2>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {profile.name
                  ?.split(" ")
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join("") || "?"}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {profile.name || "Нэр байхгүй"}
                </p>
                {profile.position_name && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs ">
                    <Briefcase className="h-3 w-3 shrink-0" />
                    {profile.position_name}
                  </p>
                )}
                {profile.department_name && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs ">
                    <Building2 className="h-3 w-3 shrink-0" />
                    {profile.department_name}
                  </p>
                )}
                {profile.phone && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs ">
                    <Phone className="h-3 w-3 shrink-0" />
                    {profile.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Key dates */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Огноо</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="">Үүсгэсэн</span>
                <span className="font-medium tabular-nums">
                  {formatDate(order.created_at)}
                </span>
              </div>
              {order.requested_delivery_date && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="">Хүргэлт</span>
                    <span className="font-medium tabular-nums">
                      {formatDate(order.requested_delivery_date)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Workflow */}
          <OrderWorkflow
            reviewers={reviewers as WorkflowReviewers}
            items={items}
          />

          {/* Process info */}
          {orderDetails.instance && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">
                Процессийн мэдээлэл
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="">Одоогийн шат</span>
                  <span className="font-semibold tabular-nums">
                    {orderDetails.instance.current_step_order}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="">Хянагчийн тоо</span>
                  <span className="font-semibold tabular-nums">
                    {reviewers.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-xs ">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
