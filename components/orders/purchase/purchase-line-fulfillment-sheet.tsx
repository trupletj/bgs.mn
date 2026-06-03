"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Factory,
  Package,
  Truck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FulfillmentHistory } from "@/components/orders/fulfillment-history";
import { cn } from "@/lib/utils";
import { transitionPurchaseFulfillmentChunk } from "@/actions/order-purchases";
import type {
  PurchaseBatchRow,
  PurchaseFulfillmentChunkRow,
  PurchaseLineRow,
} from "./types";
import {
  formatDate,
  formatMoney,
  formatQuantity,
  getUnitLabel,
  NEXT_FULFILLMENT_STATUS_OPTIONS,
  PURCHASE_MOVEMENT_LABELS,
} from "./utils";

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
  completed: {
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
    text: PURCHASE_MOVEMENT_LABELS.completed,
  },
  cancelled: {
    color: "bg-red-50 text-red-700 border-red-200",
    icon: <XCircle className="h-3 w-3" />,
    text: PURCHASE_MOVEMENT_LABELS.cancelled,
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function PurchaseLineFulfillmentSheet({
  orderId,
  line,
  batch,
  open,
  onOpenChange,
  onRefresh,
}: {
  orderId: string;
  line: PurchaseLineRow | null;
  batch: PurchaseBatchRow | null;
  open: boolean;
  onOpenChange: NonNullable<React.ComponentProps<typeof Sheet>["onOpenChange"]>;
  onRefresh: () => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [pendingChange, setPendingChange] = useState<{
    fulfillment: PurchaseFulfillmentChunkRow;
    next: string;
    maxQuantity: number;
  } | null>(null);
  const [statusChangeQuantity, setStatusChangeQuantity] = useState("");
  const [statusChangeComment, setStatusChangeComment] = useState("");

  const unit = getUnitLabel(line?.order_items?.unit ?? "pcs");
  const quantity = Number(line?.quantity ?? 0);
  const unitPrice = Number(line?.unit_price ?? 0);
  const totalPrice = quantity * unitPrice;
  const chunks = line?.order_fulfillment ?? [];

  const toggleHistory = (id: number) => {
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

  const resetPendingChange = () => {
    setPendingChange(null);
    setStatusChangeQuantity("");
    setStatusChangeComment("");
  };

  const confirmStatusChange = async () => {
    if (!pendingChange) return;

    const moveQuantity = Number(statusChangeQuantity);
    if (
      !Number.isFinite(moveQuantity) ||
      moveQuantity <= 0 ||
      moveQuantity > pendingChange.maxQuantity
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
        fulfillmentId: Number(pendingChange.fulfillment.id),
        orderId: Number(orderId),
        status: pendingChange.next,
        quantity: moveQuantity,
        note: statusChangeComment.trim() || "Хэрэглэгч өөрчилсөн",
      });
      toast.success("Статус шинэчлэгдлээ");
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Алдаа гарлаа");
    } finally {
      resetPendingChange();
    }
  };

  const renderTransitionSelect = (fulfillment: PurchaseFulfillmentChunkRow) => {
    const currentStatus = fulfillment.status?.toLowerCase();
    const nextOptions = NEXT_FULFILLMENT_STATUS_OPTIONS[currentStatus] ?? [];
    const chunkQuantity = Number(fulfillment.quantity || 0);

    return (
      <Select
        value=""
        disabled={nextOptions.length === 0}
        onValueChange={(next) => {
          if (next !== fulfillment.status) {
            setPendingChange({
              fulfillment,
              next,
              maxQuantity: chunkQuantity,
            });
            setStatusChangeQuantity(String(chunkQuantity));
            setStatusChangeComment("");
          }
        }}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Шилжүүлэх" />
        </SelectTrigger>
        <SelectContent>
          {nextOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader className="border-b border-border/60 pr-10">
            <SheetTitle>{line?.order_items?.part_name ?? "Бараа"}</SheetTitle>
            <SheetDescription>
              {line?.order_items?.part_number
                ? line.order_items.part_number
                : "Худалдан авалтын мөрийн биелэлт"}
            </SheetDescription>
          </SheetHeader>

          {line && batch && (
            <div className="flex flex-col gap-4 px-4 pb-6">
              <div className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoBlock
                  label="Нийлүүлэгч"
                  value={batch.order_suppliers?.name ?? "Компани"}
                />
                <InfoBlock
                  label="Огноо"
                  value={formatDate(batch.purchased_at)}
                />
                <InfoBlock
                  label="Дугаар"
                  value={batch.reference_number || "Дугааргүй"}
                />
                <InfoBlock
                  label="Үнийн санал"
                  value={
                    batch.order_purchase_quotes?.quote_number || "Холбоогүй"
                  }
                />
              </div>

              <div className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-3">
                <InfoBlock
                  label="Тоо"
                  value={`${formatQuantity(quantity)} ${unit}`}
                />
                <InfoBlock
                  label="Нэгж үнэ"
                  value={formatMoney(unitPrice, line.currency)}
                />
                <InfoBlock
                  label="Нийт"
                  value={formatMoney(totalPrice, line.currency)}
                  strong
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Статусын мөрүүд</h3>
                  <Badge variant="secondary">{chunks.length}</Badge>
                </div>

                {chunks.length > 0 ? (
                  <>
                    <div className="hidden overflow-x-auto rounded-lg border border-border/60 sm:block">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/60 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <th className="w-10 px-4 py-3 text-left">№</th>
                            <th className="px-4 py-3 text-left">Тоо</th>
                            <th className="px-4 py-3 text-left">Төлөв</th>
                            <th className="px-4 py-3 text-left">Огноо</th>
                            <th className="px-4 py-3 text-right">Өөрчлөх</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {chunks.map((fulfillment, index) => {
                            const statusCfg = getStatusCfg(fulfillment.status);
                            const isOpen = expandedIds.has(fulfillment.id);

                            return (
                              <React.Fragment key={fulfillment.id}>
                                <tr
                                  className="cursor-pointer transition-colors hover:bg-muted/20"
                                  onClick={() =>
                                    toggleHistory(fulfillment.id)
                                  }>
                                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                    {index + 1}
                                  </td>
                                  <td className="px-4 py-3 font-semibold tabular-nums">
                                    {formatQuantity(fulfillment.quantity)}{" "}
                                    <span className="font-normal text-muted-foreground">
                                      {unit}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "gap-1 px-2 py-0.5 text-xs",
                                        statusCfg.color,
                                      )}>
                                      {statusCfg.icon}
                                      {statusCfg.text}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                                    {formatDateTime(fulfillment.created_at)}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-right"
                                    onClick={(event) =>
                                      event.stopPropagation()
                                    }>
                                    {renderTransitionSelect(fulfillment)}
                                  </td>
                                </tr>
                                {isOpen && (
                                  <tr>
                                    <td
                                      colSpan={5}
                                      className="border-t border-border/40 bg-muted/10 px-4 py-3">
                                      <FulfillmentHistory
                                        fulfillmentId={String(fulfillment.id)}
                                      />
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col gap-2 sm:hidden">
                      {chunks.map((fulfillment) => {
                        const statusCfg = getStatusCfg(fulfillment.status);
                        const isOpen = expandedIds.has(fulfillment.id);

                        return (
                          <div
                            key={fulfillment.id}
                            className="overflow-hidden rounded-lg border border-border/60">
                            <div
                              className="flex cursor-pointer items-center gap-3 p-3"
                              onClick={() => toggleHistory(fulfillment.id)}>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold tabular-nums">
                                    {formatQuantity(fulfillment.quantity)}{" "}
                                    {unit}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "gap-1 px-1.5 py-0 text-xs",
                                      statusCfg.color,
                                    )}>
                                    {statusCfg.icon}
                                    {statusCfg.text}
                                  </Badge>
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {formatDateTime(fulfillment.created_at)}
                                </p>
                              </div>
                              <div onClick={(event) => event.stopPropagation()}>
                                {renderTransitionSelect(fulfillment)}
                              </div>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform",
                                  isOpen && "rotate-180",
                                )}
                              />
                            </div>
                            {isOpen && (
                              <div className="border-t border-border/40 bg-muted/10 p-3">
                                <FulfillmentHistory
                                  fulfillmentId={String(fulfillment.id)}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    Энэ худалдан авалтын мөр дээр биелэлт бүртгэгдээгүй байна
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!pendingChange}
        onOpenChange={(dialogOpen) => {
          if (!dialogOpen) resetPendingChange();
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Төлөв өөрчлөх</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange && (
                <>
                  Статусыг{" "}
                  <span className="font-semibold text-foreground">
                    {getStatusCfg(pendingChange.fulfillment.status).text}
                  </span>{" "}
                  →{" "}
                  <span className="font-semibold text-foreground">
                    {getStatusCfg(pendingChange.next).text}
                  </span>{" "}
                  төлөв рүү шилжүүлнэ.
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
                  шилжүүлнэ.
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
            <AlertDialogAction asChild>
              <Button type="button" onClick={confirmStatusChange}>
                Тийм, өөрчлөх
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InfoBlock({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        title={value}
        className={cn(
          "truncate tabular-nums",
          strong ? "font-semibold" : "font-medium",
        )}>
        {value}
      </p>
    </div>
  );
}
