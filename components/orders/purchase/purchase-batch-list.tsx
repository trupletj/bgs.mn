"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getOrderPurchaseDocumentUrl } from "@/actions/order-purchases";
import {
  Building2,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { PurchaseBatchRow, PurchaseLineRow } from "./types";
import {
  formatDate,
  formatMoney,
  formatQuantity,
  getUnitLabel,
} from "./utils";
import { PurchaseLineFulfillmentSheet } from "./purchase-line-fulfillment-sheet";
import { PurchaseStatusBadgeList } from "./purchase-status-badge-list";

export function PurchaseBatchList({
  orderId,
  batches,
  onRefresh,
}: {
  orderId: string;
  batches: PurchaseBatchRow[];
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState<{
    batchId: number;
    lineId: number;
  } | null>(null);
  const selectedLineId = selected?.lineId;
  const selectedBatch =
    selected ? batches.find((batch) => batch.id === selected.batchId) : null;
  const selectedLine =
    selectedLineId === undefined
      ? null
      : selectedBatch?.order_purchase_lines.find(
          (line) => line.id === selectedLineId,
        ) ?? null;

  if (batches.length === 0) return null;

  const openDocument = async (documentId: string) => {
    try {
      const url = await getOrderPurchaseDocumentUrl(documentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Файл нээхэд алдаа гарлаа",
      );
    }
  };

  const renderDocumentGroup = (
    title: string,
    documents: PurchaseBatchRow["order_purchase_documents"],
  ) => (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </p>
      {documents.length > 0 ? (
        documents.map((document) => (
          <Button
            key={document.id}
            type="button"
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => openDocument(document.id)}>
            <ExternalLink className="h-4 w-4" />
            <span className="truncate">{document.file_name}</span>
          </Button>
        ))
      ) : (
        <p className="text-xs text-muted-foreground">Файл байхгүй</p>
      )}
    </div>
  );

  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Бүртгэсэн худалдан авалтууд</h2>
          <Badge variant="secondary">{batches.length}</Badge>
        </div>

        {batches.map((batch) => {
          const invoiceCount = batch.order_purchase_documents.filter(
            (document) => document.doc_type === "invoice",
          ).length;
          const paymentCount = batch.order_purchase_documents.filter(
            (document) => document.doc_type === "payment_receipt",
          ).length;

          return (
            <div
              key={batch.id}
              className="rounded-xl border border-border bg-card">
              <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">
                      {batch.order_suppliers?.name ?? "Компани"}
                    </p>
                    {batch.order_suppliers?.registration_number && (
                      <Badge variant="outline">
                        РД {batch.order_suppliers.registration_number}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(batch.purchased_at)} ·{" "}
                    {batch.reference_number || "Дугааргүй"}
                  </p>
                  {batch.order_purchase_quotes && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Холбосон үнийн санал:{" "}
                      <span className="font-medium text-foreground">
                        {batch.order_purchase_quotes.quote_number ||
                          "Дугааргүй"}
                      </span>{" "}
                      · {formatDate(batch.order_purchase_quotes.quote_date)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <FileText className="h-3 w-3" />
                    Нэхэмжлэх {invoiceCount}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <CreditCard className="h-3 w-3" />
                    Төлбөр {paymentCount}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="flex flex-col gap-3">
                  {batch.order_purchase_lines.map((line) => (
                    <PurchaseLineCard
                      key={line.id}
                      line={line}
                      onOpen={() =>
                        setSelected({ batchId: batch.id, lineId: line.id })
                      }
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-4">
                  {renderDocumentGroup(
                    "Нэхэмжлэх файл",
                    batch.order_purchase_documents.filter(
                      (document) => document.doc_type === "invoice",
                    ),
                  )}
                  {renderDocumentGroup(
                    "Төлбөрийн файл",
                    batch.order_purchase_documents.filter(
                      (document) => document.doc_type === "payment_receipt",
                    ),
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <PurchaseLineFulfillmentSheet
        orderId={orderId}
        line={selectedLine}
        batch={selectedBatch ?? null}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onRefresh={onRefresh}
      />
    </>
  );
}

function PurchaseLineCard({
  line,
  onOpen,
}: {
  line: PurchaseLineRow;
  onOpen: () => void;
}) {
  const quantity = Number(line.quantity || 0);
  const unitPrice = Number(line.unit_price || 0);
  const totalPrice = quantity * unitPrice;
  const activeStatuses = line.order_fulfillment.reduce<Record<string, number>>(
    (totals, fulfillment) => {
      const status = fulfillment.status || "unknown";
      totals[status] = (totals[status] ?? 0) + Number(fulfillment.quantity || 0);
      return totals;
    },
    {},
  );

  return (
    <button
      type="button"
      className="rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_160px_160px] md:items-center">
        <div className="min-w-0">
          <p className="font-medium">
            {line.order_items?.part_name ?? "Бараа"}
          </p>
          {line.order_items?.part_number && (
            <p className="font-mono text-xs text-muted-foreground">
              {line.order_items.part_number}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Тоо</p>
          <p className="font-medium tabular-nums">
            {formatQuantity(quantity)} {getUnitLabel(line.order_items?.unit ?? "pcs")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Нэгж үнэ</p>
          <p className="font-medium tabular-nums">
            {formatMoney(unitPrice, line.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Нийт</p>
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold tabular-nums">
              {formatMoney(totalPrice, line.currency)}
            </p>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </div>
      </div>
      {Object.keys(activeStatuses).length > 0 && (
        <div className="mt-3">
          <PurchaseStatusBadgeList statusTotals={activeStatuses} />
        </div>
      )}
    </button>
  );
}
