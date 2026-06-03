"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  Package,
  ChevronDown,
  ClipboardList,
  CalendarDays,
  Factory,
  FileText,
} from "lucide-react";
import ImageViewer from "@/components/image-viewer";
import { getSparePartLabel } from "@/types/types";
import { getOrderItemsForOrderProcess } from "@/actions/order-process";
import { FulfillmentHistory } from "@/components/orders/fulfillment-history";
import { cn } from "@/lib/utils";
import { PurchaseBatchForm } from "@/components/orders/purchase/purchase-batch-form";
import { PurchaseImplementationDashboard } from "@/components/orders/purchase/purchase-implementation-dashboard";
import { PurchaseBatchList } from "@/components/orders/purchase/purchase-batch-list";
import { PurchaseQuoteManager } from "@/components/orders/purchase/purchase-quote-manager";
import type {
  OrderProcessItem,
  PurchaseBatchRow,
  PurchaseQuoteRow,
} from "@/components/orders/purchase/types";
import {
  formatDate,
  formatQuantity,
  getUnitLabel,
  NEXT_FULFILLMENT_STATUS_OPTIONS,
  PURCHASE_MOVEMENT_LABELS,
} from "@/components/orders/purchase/utils";
import {
  getOrderPurchaseBatches,
  getOrderPurchaseQuotes,
  transitionPurchaseFulfillmentChunk,
} from "@/actions/order-purchases";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPLETED_STATUSES = ["received", "completed", "done"];

const STATUS_CONFIG: Record<
  string,
  { color: string; icon: React.ReactNode; text: string }
> = {
  purchased: {
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="h-3 w-3" />,
    text: PURCHASE_MOVEMENT_LABELS.purchased,
  },
  at_warehouse: {
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
    icon: <Package className="h-3 w-3" />,
    text: PURCHASE_MOVEMENT_LABELS.at_warehouse,
  },
  in_delivery: {
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <Truck className="h-3 w-3" />,
    text: PURCHASE_MOVEMENT_LABELS.in_delivery,
  },
  at_mine: {
    color: "bg-violet-50 text-violet-700 border-violet-200",
    icon: <Factory className="h-3 w-3" />,
    text: PURCHASE_MOVEMENT_LABELS.at_mine,
  },
  received: {
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
    text: "Хүлээн авсан",
  },
  completed: {
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
    text: PURCHASE_MOVEMENT_LABELS.completed,
  },
  done: {
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
    text: "Дууссан",
  },
  shipped: {
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <Truck className="h-3 w-3" />,
    text: "Хүргэлтэд",
  },
  ordered: {
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="h-3 w-3" />,
    text: "Захиалсан",
  },
  cancelled: {
    color: "bg-red-50 text-red-700 border-red-200",
    icon: <XCircle className="h-3 w-3" />,
    text: "Цуцлагдсан",
  },
};

function getStatusCfg(status: string) {
  return (
    STATUS_CONFIG[status?.toLowerCase()] ?? {
      color: "bg-muted text-muted-foreground border-border",
      icon: null,
      text: status,
    }
  );
}

function formatDateTime(dt: string) {
  const d = new Date(dt);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderImplementationPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [items, setItems] = useState<OrderProcessItem[]>([]);
  const [purchaseBatches, setPurchaseBatches] = useState<PurchaseBatchRow[]>(
    [],
  );
  const [purchaseQuotes, setPurchaseQuotes] = useState<PurchaseQuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const [data, batches, quotes] = await Promise.all([
        getOrderItemsForOrderProcess(orderId),
        getOrderPurchaseBatches(orderId),
        getOrderPurchaseQuotes(orderId),
      ]);
      setItems(data as OrderProcessItem[]);
      setPurchaseBatches(batches as unknown as PurchaseBatchRow[]);
      setPurchaseQuotes(quotes as unknown as PurchaseQuoteRow[]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Өгөгдөл татахад алдаа гарлаа";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalItems = items.length;
  const orderTitle = items.find((item) => item.order_title)?.order_title;
  const requestedDeliveryDate = items.find(
    (item) => item.order_requested_delivery_date,
  )?.order_requested_delivery_date;
  const fullyCompleted = items.filter((item) => {
    const targetQuantity = Number(item.final_quantity ?? item.quantity ?? 0);
    const done = item.order_fulfillment
      .filter((f) => COMPLETED_STATUSES.includes(f.status?.toLowerCase()))
      .reduce((s, f) => s + Number(f.quantity || 0), 0);
    return targetQuantity > 0 && done >= targetQuantity;
  }).length;

  if (loading) return <PageSkeleton />;

  if (loadError) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <Link
          href="/orders/purchase"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Жагсаалт руу буцах
        </Link>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-4 py-16 text-center">
          <XCircle className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-medium">Хандах боломжгүй</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href={`/orders/purchase`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground w-fit">
          <ArrowLeft className="h-4 w-4" />
          Жагсаалт руу буцах
        </Link>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
              Захиалгын биелэлт
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight">
              {orderTitle || "Захиалга"}
            </h1>
          </div>
          {totalItems > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:min-w-[180px]">
                <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Хэрэгцээт огноо
                  </p>
                  <p className="font-semibold tabular-nums">
                    {formatDate(requestedDeliveryDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:min-w-[160px]">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Нийт биелэлт</p>
                  <p className="text-lg font-bold tabular-nums">
                    {fullyCompleted}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / {totalItems}
                    </span>
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    fullyCompleted === totalItems
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-blue-50 text-blue-700",
                  )}>
                  {totalItems > 0
                    ? Math.round((fullyCompleted / totalItems) * 100)
                    : 0}
                  %
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <PurchaseImplementationDashboard
        items={items}
        batches={purchaseBatches}
      />

      <PurchaseQuoteManager
        orderId={orderId}
        items={items}
        quotes={purchaseQuotes}
        purchaseBatches={purchaseBatches}
        onRefresh={load}
      />

      <PurchaseBatchForm
        orderId={orderId}
        items={items}
        purchaseBatches={purchaseBatches}
        purchaseQuotes={purchaseQuotes}
        onRefresh={load}
      />

      <PurchaseBatchList
        orderId={orderId}
        batches={purchaseBatches}
        onRefresh={load}
      />

      {/* Items */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Package className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-medium">Сэлбэг олдсонгүй</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Энэ захиалганд биелэлт бүртгэх зүйл байхгүй байна
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <OrderItemCard
              key={item.id}
              item={item}
              orderId={orderId}
              onRefresh={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Purchase batches ────────────────────────────────────────────────────────

// ─── Item Card// ─── Item Card ────────────────────────────────────────────────────────────────

function OrderItemCard({
  item,
  orderId,
  onRefresh,
}: {
  item: OrderProcessItem;
  orderId: string;
  onRefresh: () => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pendingChange, setPendingChange] = useState<{
    id: string;
    old: string;
    next: string;
    maxQuantity: number;
  } | null>(null);
  const [statusChangeQuantity, setStatusChangeQuantity] = useState("");
  const [statusChangeComment, setStatusChangeComment] = useState("");

  const unit = getUnitLabel(item.unit);
  const targetQuantity = Number(item.final_quantity ?? item.quantity ?? 0);

  const totalCompleted = item.order_fulfillment
    .filter((f) => COMPLETED_STATUSES.includes(f.status?.toLowerCase()))
    .reduce((s, f) => s + Number(f.quantity || 0), 0);

  const percent =
    targetQuantity > 0
      ? Math.min(100, Math.round((totalCompleted / targetQuantity) * 100))
      : 0;

  const toggleHistory = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const confirmStatusChange = async () => {
    if (!pendingChange) return;
    const quantity = Number(statusChangeQuantity);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > pendingChange.maxQuantity
    ) {
      toast.error(
        `Шилжүүлэх тоо ${formatQuantity(
          pendingChange.maxQuantity,
        )}-ээс хэтрэхгүй байх ёстой`,
      );
      return;
    }

    try {
      await transitionPurchaseFulfillmentChunk({
        fulfillmentId: Number(pendingChange.id),
        orderId: Number(orderId),
        status: pendingChange.next,
        quantity,
        note: statusChangeComment.trim() || "Хэрэглэгч өөрчилсөн",
      });
      toast.success("Статус шинэчлэгдлээ");
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Алдаа гарлаа");
    } finally {
      setPendingChange(null);
      setStatusChangeQuantity("");
      setStatusChangeComment("");
    }
  };

  return (
    <>
      <section className="rounded-xl border border-border bg-card">
        {/* Item header */}
        <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-4 w-4" />
            </div>
            <div className="min-w-0 ">
              <p className="font-semibold text-foreground leading-tight">
                {item.part_name}
              </p>
              {item.part_number && (
                <p className="mt-0.5 font-mono text-xs ">{item.part_number}</p>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 sm:min-w-[200px]">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Биелэлт</span>
                <span className="font-semibold tabular-nums">
                  {formatQuantity(totalCompleted)} /{" "}
                  {formatQuantity(targetQuantity)} {unit}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    percent >= 100
                      ? "bg-emerald-500"
                      : percent >= 50
                        ? "bg-amber-500"
                        : "bg-primary",
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                percent >= 100
                  ? "bg-emerald-100 text-emerald-700"
                  : percent >= 50
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-50 text-blue-700",
              )}>
              {percent}%
            </div>
          </div>
        </div>

        {/* Item details */}
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <InlineItemInfo
                icon={Package}
                label="Төрөл"
                value={getSparePartLabel(item.spare_type ?? undefined)}
              />
              {item.manufacturer && (
                <InlineItemInfo
                  icon={Factory}
                  label="Үйлдвэрлэгч"
                  value={item.manufacturer}
                />
              )}
              {item.part_description && (
                <InlineItemInfo
                  icon={FileText}
                  label="Тайлбар"
                  value={item.part_description}
                  wide
                />
              )}
              {item.notes && (
                <InlineItemInfo
                  icon={ClipboardList}
                  label="Тэмдэглэл"
                  value={item.notes}
                  wide
                />
              )}
            </div>

            {item.image_url && (
              <div className="shrink-0 lg:pl-4">
                <ImageViewer images={[item.image_url]} />
              </div>
            )}
          </div>
        </div>

        {/* Fulfillment list */}
        <div className="p-5 space-y-4">
          {item.order_fulfillment?.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 text-left w-10">№</th>
                      <th className="px-4 py-3 text-left">Тоо хэмжээ</th>
                      <th className="px-4 py-3 text-left">Төлөв</th>
                      <th className="px-4 py-3 text-left">Тэмдэглэл</th>
                      <th className="px-4 py-3 text-left">Огноо</th>
                      <th className="px-4 py-3 text-right">Өөрчлөх</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {item.order_fulfillment.map((f, idx) => {
                      const scfg = getStatusCfg(f.status);
                      const isOpen = expandedIds.has(f.id);
                      const quantity = Number(f.quantity || 0);
                      const nextOptions =
                        NEXT_FULFILLMENT_STATUS_OPTIONS[
                          f.status?.toLowerCase()
                        ] ?? [];
                      return (
                        <React.Fragment key={f.id}>
                          <tr
                            className="cursor-pointer transition-colors hover:bg-muted/20"
                            onClick={() => toggleHistory(f.id)}>
                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 font-semibold tabular-nums">
                              {formatQuantity(quantity)}{" "}
                              <span className="font-normal text-muted-foreground">
                                {unit}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "gap-1 text-xs px-2 py-0.5",
                                  scfg.color,
                                )}>
                                {scfg.icon}
                                {scfg.text}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                              {f.notes || "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                              {formatDateTime(f.created_at)}
                            </td>
                            <td
                              className="px-4 py-3 text-right"
                              onClick={(e) => e.stopPropagation()}>
                              <Select
                                value=""
                                disabled={nextOptions.length === 0}
                                onValueChange={(next) => {
                                  if (next !== f.status) {
                                    setPendingChange({
                                      id: f.id,
                                      old: f.status,
                                      next,
                                      maxQuantity: quantity,
                                    });
                                    setStatusChangeQuantity(String(quantity));
                                    setStatusChangeComment("");
                                  }
                                }}>
                                <SelectTrigger className="h-7 w-36 text-xs">
                                  <SelectValue placeholder="Шилжүүлэх" />
                                </SelectTrigger>
                                <SelectContent>
                                  {nextOptions.map((o) => (
                                    <SelectItem
                                      key={o.value}
                                      value={o.value}
                                      className="text-xs">
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-4 py-3 bg-muted/10 border-t border-border/40">
                                <FulfillmentHistory fulfillmentId={f.id} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="flex flex-col gap-2 sm:hidden">
                {item.order_fulfillment.map((f) => {
                  const scfg = getStatusCfg(f.status);
                  const isOpen = expandedIds.has(f.id);
                  const quantity = Number(f.quantity || 0);
                  const nextOptions =
                    NEXT_FULFILLMENT_STATUS_OPTIONS[f.status?.toLowerCase()] ??
                    [];
                  return (
                    <div
                      key={f.id}
                      className="rounded-lg border border-border/60 overflow-hidden">
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer"
                        onClick={() => toggleHistory(f.id)}>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold tabular-nums">
                              {formatQuantity(quantity)} {unit}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "gap-1 text-xs px-1.5 py-0",
                                scfg.color,
                              )}>
                              {scfg.icon}
                              {scfg.text}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDateTime(f.created_at)}
                          </p>
                          {f.notes && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {f.notes}
                            </p>
                          )}
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Select
                            value=""
                            disabled={nextOptions.length === 0}
                            onValueChange={(next) => {
                              if (next !== f.status) {
                                setPendingChange({
                                  id: f.id,
                                  old: f.status,
                                  next,
                                  maxQuantity: quantity,
                                });
                                setStatusChangeQuantity(String(quantity));
                                setStatusChangeComment("");
                              }
                            }}>
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue placeholder="Шилжүүлэх" />
                            </SelectTrigger>
                            <SelectContent>
                              {nextOptions.map((o) => (
                                <SelectItem
                                  key={o.value}
                                  value={o.value}
                                  className="text-xs">
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                      </div>
                      {isOpen && (
                        <div className="border-t border-border/40 p-3 bg-muted/10">
                          <FulfillmentHistory fulfillmentId={f.id} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Биелэлт бүртгэгдээгүй байна
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Status change confirmation dialog */}
      <AlertDialog
        open={!!pendingChange}
        onOpenChange={(open) => {
          if (!open) {
            setPendingChange(null);
            setStatusChangeQuantity("");
            setStatusChangeComment("");
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Төлөв өөрчлөх</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange && (
                <>
                  Статусыг{" "}
                  <span className="font-semibold text-foreground">
                    {PURCHASE_MOVEMENT_LABELS[pendingChange.old] ??
                      getStatusCfg(pendingChange.old).text}
                  </span>{" "}
                  →{" "}
                  <span className="font-semibold text-foreground">
                    {PURCHASE_MOVEMENT_LABELS[pendingChange.next] ??
                      getStatusCfg(pendingChange.next).text}
                  </span>{" "}
                  төлөв рүү шилжүүлэхдээ итгэлтэй байна уу?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Шилжүүлэх тоо
              </label>
              <Input
                type="number"
                min="0"
                max={pendingChange?.maxQuantity}
                value={statusChangeQuantity}
                onChange={(event) =>
                  setStatusChangeQuantity(event.target.value)
                }
                placeholder="Тоо хэмжээ"
              />
              {pendingChange && (
                <p className="text-xs text-muted-foreground">
                  Энэ мөрөөс хамгийн ихдээ{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatQuantity(pendingChange.maxQuantity)} {unit}
                  </span>{" "}
                  шилжүүлнэ. Бага тоо оруулбал үлдсэн тоо хуучин төлөв дээрээ
                  үлдэнэ.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Тайлбар
              </label>
              <Input
                value={statusChangeComment}
                onChange={(event) => setStatusChangeComment(event.target.value)}
                placeholder="Төлөв өөрчилсөн тайлбар..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              Тийм, өөрчлөх
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InlineItemInfo({
  icon: Icon,
  label,
  value,
  wide = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5",
        wide ? "max-w-full sm:max-w-[360px]" : "max-w-full sm:max-w-[220px]",
      )}>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-xs text-muted-foreground">{label}:</span>
      <span
        title={value}
        className={cn(
          "min-w-0 truncate text-sm font-medium text-foreground",
          wide && "sm:max-w-[280px]",
        )}>
        {value}
      </span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-48" />
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-9 w-40" />
          </div>
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
