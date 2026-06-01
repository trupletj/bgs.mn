"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, PackageCheck, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getOrderPurchaseBatches } from "@/actions/order-purchases";
import type { PurchaseBatchRow, PurchaseLineRow } from "./types";
import { PurchaseStatusBadgeList } from "./purchase-status-badge-list";
import { formatMoney, formatQuantity, getUnitLabel } from "./utils";

type OrderPurchaseSummaryItem = {
  id: number | string;
  part_name: string;
  part_number?: string | null;
  quantity: number;
  final_quantity?: number | null;
  unit: string;
};

type CurrencyTotals = Record<string, number>;
type StatusTotals = Record<string, number>;

type ItemPurchaseSummary = {
  item: OrderPurchaseSummaryItem;
  unit: string;
  requiredQuantity: number;
  purchasedQuantity: number;
  spendByCurrency: CurrencyTotals;
  statusTotals: StatusTotals;
  lines: Array<{
    batch: PurchaseBatchRow;
    line: PurchaseLineRow;
    statusTotals: StatusTotals;
    spendTotal: number;
  }>;
};

export function OrderPurchaseSummaryPanel({
  orderId,
  items,
  canViewPrices = false,
}: {
  orderId: string | number;
  items: OrderPurchaseSummaryItem[];
  canViewPrices?: boolean;
}) {
  const [batches, setBatches] = useState<PurchaseBatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<number | string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPurchases() {
      try {
        setLoading(true);
        const data = await getOrderPurchaseBatches(orderId);
        if (!cancelled) {
          setBatches(data as unknown as PurchaseBatchRow[]);
          setHasAccess(true);
        }
      } catch {
        if (!cancelled) {
          setBatches([]);
          setHasAccess(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPurchases();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const rows = useMemo(() => buildRows(items, batches), [items, batches]);
  const selectedRow =
    selectedItemId === null
      ? null
      : (rows.find((row) => String(row.item.id) === String(selectedItemId)) ??
        null);
  const totalPurchased = rows.reduce(
    (sum, row) => sum + row.purchasedQuantity,
    0,
  );
  const totalSpend = rows.reduce<CurrencyTotals>((totals, row) => {
    for (const [currency, amount] of Object.entries(row.spendByCurrency)) {
      totals[currency] = (totals[currency] ?? 0) + amount;
    }
    return totals;
  }, {});
  const purchasedItemCount = rows.filter(
    (row) => row.purchasedQuantity > 0,
  ).length;

  if (!hasAccess || (!loading && batches.length === 0)) return null;

  return (
    <>
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Худалдан авалтын явц</h2>
          </div>
          {loading ? (
            <span className="text-xs text-muted-foreground">
              Уншиж байна...
            </span>
          ) : (
            <Badge variant="secondary">{purchasedItemCount} бараа</Badge>
          )}
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <SummaryMetric
              icon={PackageCheck}
              label="Худалдан авсан"
              value={formatQuantity(totalPurchased)}
              detail="Нийт ширхэг"
            />
            {canViewPrices && (
              <SummaryMetric
                icon={CircleDollarSign}
                label="Зарцуулалт"
                value={formatCurrencyTotals(totalSpend)}
                detail=""
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <button
                key={row.item.id}
                type="button"
                className="rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setSelectedItemId(row.item.id)}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">
                      {row.item.part_name}
                    </p>
                    {row.item.part_number && (
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {row.item.part_number}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <QuantityText
                      label="Шаардлагатай"
                      quantity={row.requiredQuantity}
                      unit={row.unit}
                    />
                    <QuantityText
                      label="Худалдан авсан"
                      quantity={row.purchasedQuantity}
                      unit={row.unit}
                      strong
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <PurchaseStatusBadgeList statusTotals={row.statusTotals} />
                  {canViewPrices && (
                    <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {formatCurrencyTotals(row.spendByCurrency)}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <Sheet
        open={!!selectedRow}
        onOpenChange={(open) => {
          if (!open) setSelectedItemId(null);
        }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="border-b border-border/60 pr-10">
            <SheetTitle>{selectedRow?.item.part_name ?? "Бараа"}</SheetTitle>
            <SheetDescription>
              {selectedRow?.item.part_number ?? "Худалдан авалтын дэлгэрэнгүй"}
            </SheetDescription>
          </SheetHeader>
          {selectedRow && (
            <div className="flex flex-col gap-4 px-4 pb-6">
              <div className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-3">
                <QuantityInfo
                  label="Шаардлагатай"
                  quantity={selectedRow.requiredQuantity}
                  unit={selectedRow.unit}
                />
                <QuantityInfo
                  label="Худалдан авсан"
                  quantity={selectedRow.purchasedQuantity}
                  unit={selectedRow.unit}
                />
                {canViewPrices && (
                  <div>
                    <p className="text-xs text-muted-foreground">Зарцуулалт</p>
                    <p className="font-semibold tabular-nums">
                      {formatCurrencyTotals(selectedRow.spendByCurrency)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-semibold">Худалдан авалтын мөрүүд</h3>
                {selectedRow.lines.length > 0 ? (
                  selectedRow.lines.map(
                    ({ batch, line, statusTotals, spendTotal }) => {
                      const quantity = Number(line.quantity || 0);
                      const unitPrice = Number(line.unit_price || 0);

                      return (
                        <div
                          key={line.id}
                          className="rounded-lg border border-border/60 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold tabular-nums">
                                {formatQuantity(quantity)} {selectedRow.unit}
                                {canViewPrices && (
                                  <>
                                    {" "}
                                    x {formatMoney(unitPrice, line.currency)}
                                  </>
                                )}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {batch.order_suppliers?.name ?? "Компани"}
                                {batch.reference_number
                                  ? ` · ${batch.reference_number}`
                                  : ""}
                              </p>
                            </div>
                            {canViewPrices && (
                              <p className="font-semibold tabular-nums">
                                {formatMoney(spendTotal, line.currency)}
                              </p>
                            )}
                          </div>
                          <div className="mt-3">
                            <PurchaseStatusBadgeList
                              statusTotals={statusTotals}
                            />
                          </div>
                        </div>
                      );
                    },
                  )
                ) : (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    Худалдан авалт бүртгэгдээгүй байна
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function buildRows(
  items: OrderPurchaseSummaryItem[],
  batches: PurchaseBatchRow[],
): ItemPurchaseSummary[] {
  const rowMap = new Map<string, ItemPurchaseSummary>();

  for (const item of items) {
    rowMap.set(String(item.id), {
      item,
      unit: getUnitLabel(item.unit),
      requiredQuantity: Number(item.final_quantity ?? item.quantity ?? 0),
      purchasedQuantity: 0,
      spendByCurrency: {},
      statusTotals: {},
      lines: [],
    });
  }

  for (const batch of batches) {
    for (const line of batch.order_purchase_lines) {
      const key = String(line.order_item_id);
      const row = rowMap.get(key);
      if (!row) continue;

      const quantity = Number(line.quantity || 0);
      const unitPrice = Number(line.unit_price || 0);
      const vatAmount = Number(line.vat_amount || 0);
      const discountAmount = Number(line.discount_amount || 0);
      const currency = line.currency || "MNT";
      const spendTotal = quantity * unitPrice + vatAmount - discountAmount;
      const lineStatusTotals = buildLineStatusTotals(line);

      row.purchasedQuantity += quantity;
      row.spendByCurrency[currency] =
        (row.spendByCurrency[currency] ?? 0) + spendTotal;

      for (const [status, statusQuantity] of Object.entries(lineStatusTotals)) {
        row.statusTotals[status] =
          (row.statusTotals[status] ?? 0) + statusQuantity;
      }

      row.lines.push({
        batch,
        line,
        statusTotals: lineStatusTotals,
        spendTotal,
      });
    }
  }

  return [...rowMap.values()];
}

function buildLineStatusTotals(line: PurchaseLineRow) {
  return line.order_fulfillment.reduce<StatusTotals>((totals, fulfillment) => {
    const status = fulfillment.status || "unknown";
    totals[status] = (totals[status] ?? 0) + Number(fulfillment.quantity || 0);
    return totals;
  }, {});
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-bold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function QuantityText({
  label,
  quantity,
  unit,
  strong = false,
}: {
  label: string;
  quantity: number;
  unit: string;
  strong?: boolean;
}) {
  return (
    <div className="text-right">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`tabular-nums ${
          strong ? "font-semibold text-foreground" : "font-medium"
        }`}>
        {formatQuantity(quantity)}{" "}
        <span className="font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

function QuantityInfo({
  label,
  quantity,
  unit,
}: {
  label: string;
  quantity: number;
  unit: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">
        {formatQuantity(quantity)}{" "}
        <span className="font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

function formatCurrencyTotals(totals: CurrencyTotals) {
  const entries = Object.entries(totals).filter(([, amount]) => amount !== 0);
  if (entries.length === 0) return "-";
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(" · ");
}
