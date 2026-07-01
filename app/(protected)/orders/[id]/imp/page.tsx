"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  ShoppingCart,
  Truck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrderItemsForOrderProcess } from "@/actions/order-process";
import { PurchaseImplementationDashboard } from "@/components/orders/purchase/purchase-implementation-dashboard";
import { PurchaseQuoteManager } from "@/components/orders/purchase/purchase-quote-manager";
import { PurchaseBatchForm } from "@/components/orders/purchase/purchase-batch-form";
import { PurchaseBatchList } from "@/components/orders/purchase/purchase-batch-list";
import { PurchaseFulfillmentBoard } from "@/components/orders/purchase/purchase-fulfillment-board";
import type {
  OrderProcessItem,
  PurchaseBatchRow,
  PurchaseQuoteRow,
} from "@/components/orders/purchase/types";
import { formatDate } from "@/components/orders/purchase/utils";
import {
  getOrderPurchaseBatches,
  getOrderPurchaseQuotes,
} from "@/actions/order-purchases";

const COMPLETED_STATUSES = ["received", "completed", "done"];

type StepKey = "quotes" | "purchase" | "delivery";

export default function OrderImplementationPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [items, setItems] = useState<OrderProcessItem[]>([]);
  const [purchaseBatches, setPurchaseBatches] = useState<PurchaseBatchRow[]>([]);
  const [purchaseQuotes, setPurchaseQuotes] = useState<PurchaseQuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<StepKey>("quotes");
  const [showDashboard, setShowDashboard] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const [data, batches, quotes] = await Promise.all([
        getOrderItemsForOrderProcess(orderId),
        getOrderPurchaseBatches(orderId, true),
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

  // Step 1: unique items covered by at least one quote line
  const quotedItemIds = useMemo(
    () =>
      new Set(
        purchaseQuotes.flatMap((q) =>
          q.order_purchase_quote_lines.map((l) => l.order_item_id),
        ),
      ),
    [purchaseQuotes],
  );

  // Step 2: items where purchased qty >= required qty
  const fullyPurchasedCount = useMemo(() => {
    const purchasedByItem = new Map<number, number>();
    for (const batch of purchaseBatches) {
      for (const line of batch.order_purchase_lines) {
        purchasedByItem.set(
          line.order_item_id,
          (purchasedByItem.get(line.order_item_id) ?? 0) + Number(line.quantity || 0),
        );
      }
    }
    return items.filter((item) => {
      const required = Number(item.final_quantity ?? item.quantity ?? 0);
      return required > 0 && (purchasedByItem.get(item.id) ?? 0) >= required;
    }).length;
  }, [items, purchaseBatches]);

  // Step 3: items fully delivered / completed
  const fullyDeliveredCount = useMemo(
    () =>
      items.filter((item) => {
        const required = Number(item.final_quantity ?? item.quantity ?? 0);
        const delivered = item.order_fulfillment
          .filter((f) => COMPLETED_STATUSES.includes(f.status?.toLowerCase()))
          .reduce((s, f) => s + Number(f.quantity || 0), 0);
        return required > 0 && delivered >= required;
      }).length,
    [items],
  );

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
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{loadError}</p>
        </div>
      </div>
    );
  }

  const steps: {
    key: StepKey;
    label: string;
    Icon: React.ElementType;
    badge: string;
    done: boolean;
  }[] = [
    {
      key: "quotes",
      label: "Үнийн санал",
      Icon: FileText,
      badge:
        purchaseQuotes.length > 0
          ? `${purchaseQuotes.length} санал`
          : "Санал алга",
      done:
        purchaseQuotes.length > 0 &&
        totalItems > 0 &&
        quotedItemIds.size >= totalItems,
    },
    {
      key: "purchase",
      label: "Худалдан авалт",
      Icon: ShoppingCart,
      badge: totalItems > 0 ? `${fullyPurchasedCount}/${totalItems} бараа` : "—",
      done: totalItems > 0 && fullyPurchasedCount >= totalItems,
    },
    {
      key: "delivery",
      label: "Хүргэлт",
      Icon: Truck,
      badge: totalItems > 0 ? `${fullyDeliveredCount}/${totalItems} бараа` : "—",
      done: totalItems > 0 && fullyDeliveredCount >= totalItems,
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4 pt-4 pb-3 lg:px-6 lg:pt-6">
        <Link
          href="/orders/purchase"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Жагсаалт руу буцах
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
              Захиалгын биелэлт
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight">
              {orderTitle ?? "Захиалга"}
            </h1>
          </div>
          {requestedDeliveryDate && (
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Хэрэгцээт огноо</p>
                <p className="font-semibold tabular-nums">
                  {formatDate(requestedDeliveryDate)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky: status strip + quest stepper ─────────────────── */}
      <div
        className="sticky z-10 border-b border-border/60 bg-background/95 backdrop-blur-sm"
        style={{ top: "var(--header-height, 48px)" }}>
        {/* Шаардлагатай бараа toggle strip */}
        <button
          type="button"
          onClick={() => setShowDashboard((v) => !v)}
          className="flex w-full items-center gap-2 border-b border-border/40 px-4 py-2 text-left transition-colors hover:bg-muted/30 lg:px-6">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Шаардлагатай бараа
          </span>
          <span className="text-xs text-foreground/60">
            {totalItems > 0 ? `${totalItems} бараа` : "—"}
          </span>
          {totalItems > 0 && (
            <>
              <span className="text-xs text-muted-foreground/30">·</span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  fullyDeliveredCount === totalItems
                    ? "font-medium text-emerald-600"
                    : "text-muted-foreground/60",
                )}>
                {fullyDeliveredCount}/{totalItems} дууссан
              </span>
            </>
          )}
          <div className="ml-auto flex items-center gap-1 text-muted-foreground/40">
            <span className="text-[11px]">{showDashboard ? "нуух" : "дэлгэх"}</span>
            {showDashboard ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </div>
        </button>

        {/* Quest stepper */}
        <div className="px-4 py-4 lg:px-6">
          <div className="flex items-center">
            {steps.map((step, i) => {
              const isActive = activeStep === step.key;
              const prevDone = i > 0 && steps[i - 1].done;
              return (
                <Fragment key={step.key}>
                  {i > 0 && (
                    <div
                      className={cn(
                        "mx-3 h-0.5 w-10 shrink-0 rounded-full transition-colors",
                        prevDone ? "bg-emerald-400/60" : "bg-border",
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveStep(step.key)}
                    className="flex flex-col items-center gap-2">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full border-2 text-base font-bold transition-all",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                          : step.done
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/50",
                      )}>
                      {step.done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                    <div className="text-center">
                      <p
                        className={cn(
                          "whitespace-nowrap text-sm font-medium leading-tight",
                          isActive ? "text-foreground" : "text-muted-foreground",
                        )}>
                        {step.label}
                      </p>
                      <p
                        className={cn(
                          "tabular-nums text-xs leading-tight",
                          step.done
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground/50",
                        )}>
                        {step.badge}
                      </p>
                    </div>
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Items overview (collapsible, in-flow) ─────────────────── */}
      {showDashboard && totalItems > 0 && (
        <div className="border-b border-border/60 px-4 py-4 lg:px-6">
          <PurchaseImplementationDashboard items={items} batches={purchaseBatches} />
        </div>
      )}

      {/* ── Active step content ────────────────────────────────────── */}
      <div className="flex-1 px-4 py-6 lg:px-6">
        {activeStep === "quotes" && (
          <PurchaseQuoteManager
            orderId={orderId}
            items={items}
            quotes={purchaseQuotes}
            purchaseBatches={purchaseBatches}
            onRefresh={load}
          />
        )}
        {activeStep === "purchase" && (
          <div className="flex flex-col gap-6">
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
          </div>
        )}
        {activeStep === "delivery" && (
          <PurchaseFulfillmentBoard
            orderId={orderId}
            batches={purchaseBatches}
            onRefresh={load}
          />
        )}
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-48" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-4 rounded-xl border border-border bg-card p-5">
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
