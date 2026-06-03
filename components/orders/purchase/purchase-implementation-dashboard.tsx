"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Boxes,
  CircleDollarSign,
  ClipboardList,
  PackageCheck,
} from "lucide-react";
import type { OrderProcessItem, PurchaseBatchRow } from "./types";
import {
  formatMoney,
  formatQuantity,
  getUnitLabel,
  PURCHASE_MOVEMENT_LABELS,
} from "./utils";
import {
  PurchaseStatusBadgeList,
  PURCHASE_STATUS_ORDER,
} from "./purchase-status-badge-list";

type CurrencyTotals = Record<string, number>;
type StatusTotals = Record<string, number>;

type ItemDashboardRow = {
  id: number;
  partName: string;
  partNumber?: string | null;
  unit: string;
  requiredQuantity: number;
  purchasedQuantity: number;
  statusTotals: StatusTotals;
  spendByCurrency: CurrencyTotals;
  purchaseLineCount: number;
  priceBreakdowns: PriceBreakdownRow[];
};

type PriceBreakdownRow = {
  key: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  supplierName: string;
  referenceNumber?: string | null;
  statusTotals: StatusTotals;
  spendTotal: number;
};

export function PurchaseImplementationDashboard({
  items,
  batches,
}: {
  items: OrderProcessItem[];
  batches: PurchaseBatchRow[];
}) {
  console.log(
    "Rendering PurchaseImplementationDashboard with items and batches:",
    {
      items,
      batches,
    },
  );
  const rows = buildRows(items, batches);
  const totalSpend = rows.reduce<CurrencyTotals>((totals, row) => {
    for (const [currency, amount] of Object.entries(row.spendByCurrency)) {
      totals[currency] = (totals[currency] ?? 0) + amount;
    }
    return totals;
  }, {});
  const totalStatus = rows.reduce<StatusTotals>((totals, row) => {
    for (const [status, quantity] of Object.entries(row.statusTotals)) {
      totals[status] = (totals[status] ?? 0) + quantity;
    }
    return totals;
  }, {});
  const fullyPurchasedCount = rows.filter(
    (row) =>
      row.requiredQuantity > 0 && row.purchasedQuantity >= row.requiredQuantity,
  ).length;
  const purchasedLineCount = batches.reduce(
    (sum, batch) => sum + batch.order_purchase_lines.length,
    0,
  );

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Худалдан авалтын нэгтгэл</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryPanel
          icon={Boxes}
          label="Бараа материалын тоо"
          value={formatQuantity(rows.length)}
          detail={`Бүрэн худалдан авсан ${formatQuantity(fullyPurchasedCount)}`}
        />
        <SummaryPanel
          icon={PackageCheck}
          label="Худалдан авсан барааны төрөл"
          value={formatQuantity(purchasedLineCount)}
          detail={`Худалдан авалтын бүртгэл ${formatQuantity(batches.length)}`}
        />
        <SummaryPanel
          icon={CircleDollarSign}
          label="Нийт үнэ"
          value={formatCurrencyTotals(totalSpend)}
          detail=""
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-semibold">Бараа материалын захиалгын явц</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Шаардлагатай тоо, худалдаж авсан тоо, хүргэлт/агуулах/уурхайд
                очсон эсэх болон зарцуулсан дүн.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PURCHASE_STATUS_ORDER.map((status) => (
                <Badge key={status} variant="outline" className="text-[11px]">
                  {PURCHASE_MOVEMENT_LABELS[status]}{" "}
                  {formatQuantity(totalStatus[status] ?? 0)}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 text-left">Бараа</th>
                <th className="px-4 py-3 text-right">Шаардлагатай</th>
                <th className="px-4 py-3 text-right">Худалдан авсан</th>
                <th className="px-4 py-3 text-right">Үлдэгдэл</th>
                <th className="px-4 py-3 text-left">Процесс</th>
                <th className="px-5 py-3 text-right">Нийт үнэ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((row) => {
                const remaining = Math.max(
                  0,
                  row.requiredQuantity - row.purchasedQuantity,
                );
                const percent =
                  row.requiredQuantity > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (row.purchasedQuantity / row.requiredQuantity) * 100,
                        ),
                      )
                    : 0;

                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-5 py-3">
                      <div className="min-w-0">
                        <p className="font-medium leading-tight">
                          {row.partName}
                        </p>
                        {row.partNumber && (
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {row.partNumber}
                          </p>
                        )}
                        <div className="mt-2 h-1.5 max-w-56 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <QuantityCell
                      quantity={row.requiredQuantity}
                      unit={row.unit}
                    />
                    <PurchasedQuantityCell unit={row.unit} row={row} />
                    <QuantityCell quantity={remaining} unit={row.unit} muted />
                    <td className="px-4 py-3">
                      <PurchaseStatusBadgeList
                        statusTotals={row.statusTotals}
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <p className="font-semibold tabular-nums">
                        {formatCurrencyTotals(row.spendByCurrency)}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function buildRows(
  items: OrderProcessItem[],
  batches: PurchaseBatchRow[],
): ItemDashboardRow[] {
  const rowMap = new Map<number, ItemDashboardRow>();

  for (const item of items) {
    rowMap.set(item.id, {
      id: item.id,
      partName: item.part_name,
      partNumber: item.part_number,
      unit: getUnitLabel(item.unit),
      requiredQuantity: Number(item.final_quantity ?? item.quantity ?? 0),
      purchasedQuantity: 0,
      statusTotals: {},
      spendByCurrency: {},
      purchaseLineCount: 0,
      priceBreakdowns: [],
    });
  }

  for (const batch of batches) {
    for (const line of batch.order_purchase_lines) {
      const row =
        rowMap.get(line.order_item_id) ??
        createFallbackRow(line.order_item_id, line);
      const quantity = Number(line.quantity || 0);
      const unitPrice = Number(line.unit_price || 0);
      const vatAmount = Number(line.vat_amount || 0);
      const discountAmount = Number(line.discount_amount || 0);
      const currency = line.currency || "MNT";
      const lineSpend = quantity * unitPrice + vatAmount - discountAmount;

      row.purchasedQuantity += quantity;
      row.purchaseLineCount += 1;
      row.spendByCurrency[currency] =
        (row.spendByCurrency[currency] ?? 0) + lineSpend;

      const breakdownKey = [
        currency,
        unitPrice,
        batch.order_suppliers?.name ?? "Компани",
        batch.reference_number ?? "",
      ].join("|");
      let breakdown = row.priceBreakdowns.find(
        (current) => current.key === breakdownKey,
      );
      if (!breakdown) {
        breakdown = {
          key: breakdownKey,
          quantity: 0,
          unitPrice,
          currency,
          supplierName: batch.order_suppliers?.name ?? "Компани",
          referenceNumber: batch.reference_number,
          statusTotals: {},
          spendTotal: 0,
        };
        row.priceBreakdowns.push(breakdown);
      }

      breakdown.quantity += quantity;
      breakdown.spendTotal += lineSpend;

      for (const fulfillment of line.order_fulfillment) {
        const status = fulfillment.status || "unknown";
        const fulfillmentQuantity = Number(fulfillment.quantity || 0);
        row.statusTotals[status] =
          (row.statusTotals[status] ?? 0) + fulfillmentQuantity;
        breakdown.statusTotals[status] =
          (breakdown.statusTotals[status] ?? 0) + fulfillmentQuantity;
      }

      rowMap.set(row.id, row);
    }
  }

  return [...rowMap.values()];
}

function createFallbackRow(
  id: number,
  line: PurchaseBatchRow["order_purchase_lines"][number],
): ItemDashboardRow {
  return {
    id,
    partName: line.order_items?.part_name ?? "Бараа",
    partNumber: line.order_items?.part_number,
    unit: getUnitLabel(line.order_items?.unit ?? "pcs"),
    requiredQuantity: 0,
    purchasedQuantity: 0,
    statusTotals: {},
    spendByCurrency: {},
    purchaseLineCount: 0,
    priceBreakdowns: [],
  };
}

function SummaryPanel({
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
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function QuantityCell({
  quantity,
  unit,
  muted = false,
}: {
  quantity: number;
  unit: string;
  muted?: boolean;
}) {
  return (
    <td
      className={`px-4 py-3 text-right font-medium tabular-nums ${
        muted ? "text-muted-foreground" : ""
      }`}>
      {formatQuantity(quantity)}{" "}
      <span className="font-normal text-muted-foreground">{unit}</span>
    </td>
  );
}

function PurchasedQuantityCell({
  row,
  unit,
}: {
  row: ItemDashboardRow;
  unit: string;
}) {
  const hasBreakdown = row.priceBreakdowns.length > 0;

  return (
    <td className="px-4 py-3 text-right font-medium tabular-nums">
      {hasBreakdown ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-end gap-1 rounded-md border border-dashed border-primary/30 px-2 py-1 text-right font-medium tabular-nums transition-colors hover:bg-primary/5">
              <span>{formatQuantity(row.purchasedQuantity)}</span>
              <span className="font-normal text-muted-foreground">{unit}</span>
              {row.priceBreakdowns.length > 1 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {row.priceBreakdowns.length} үнэ
                </Badge>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="left"
            className="max-w-[420px] bg-background p-3 text-foreground shadow-xl">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Худалдан авсан үнэ, тоо
              </p>
              {row.priceBreakdowns.map((breakdown) => (
                <PriceBreakdown
                  key={breakdown.key}
                  breakdown={breakdown}
                  unit={unit}
                />
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      ) : (
        <>
          {formatQuantity(row.purchasedQuantity)}{" "}
          <span className="font-normal text-muted-foreground">{unit}</span>
        </>
      )}
    </td>
  );
}

function PriceBreakdown({
  breakdown,
  unit,
}: {
  breakdown: PriceBreakdownRow;
  unit: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-semibold tabular-nums">
          {formatQuantity(breakdown.quantity)} {unit} ×{" "}
          {formatMoney(breakdown.unitPrice, breakdown.currency)}
        </span>
        <span className="text-muted-foreground">
          {breakdown.supplierName}
          {breakdown.referenceNumber ? ` · ${breakdown.referenceNumber}` : ""}
        </span>
        <span className="ml-auto font-medium tabular-nums">
          {formatMoney(breakdown.spendTotal, breakdown.currency)}
        </span>
      </div>
      <div className="mt-1">
        <PurchaseStatusBadgeList statusTotals={breakdown.statusTotals} />
      </div>
    </div>
  );
}

function formatCurrencyTotals(totals: CurrencyTotals) {
  const entries = Object.entries(totals).filter(([, amount]) => amount !== 0);
  if (entries.length === 0) return "—";
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(" · ");
}
