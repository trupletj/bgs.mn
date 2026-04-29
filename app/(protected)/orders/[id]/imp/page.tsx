"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { createFulfillment } from "@/actions/fulfillment";
import {
  ArrowLeft,
  Plus,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  Package,
  ChevronDown,
  ClipboardList,
} from "lucide-react";
import { UNIT_OPTIONS } from "@/types";
import {
  getOrderItemsForOrderProcess,
  updateFulfillmentStatus,
} from "@/actions/order-process";
import { FulfillmentHistory } from "@/components/orders/fulfillment-history";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "ordered",   label: "Захиалсан" },
  { value: "shipped",   label: "Хүргэлтэд гарсан" },
  { value: "received",  label: "Хүлээн авсан" },
  { value: "completed", label: "Дууссан" },
  { value: "cancelled", label: "Цуцлагдсан" },
];

const COMPLETED_STATUSES = ["received", "completed", "done"];

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  received:  { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" />, text: "Хүлээн авсан" },
  completed: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" />, text: "Дууссан" },
  done:      { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" />, text: "Дууссан" },
  shipped:   { color: "bg-amber-50 text-amber-700 border-amber-200",       icon: <Truck className="h-3 w-3" />,          text: "Хүргэлтэд" },
  ordered:   { color: "bg-blue-50 text-blue-700 border-blue-200",          icon: <Clock className="h-3 w-3" />,          text: "Захиалсан" },
  cancelled: { color: "bg-red-50 text-red-700 border-red-200",             icon: <XCircle className="h-3 w-3" />,        text: "Цуцлагдсан" },
};

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status?.toLowerCase()] ?? {
    color: "bg-muted text-muted-foreground border-border",
    icon: null,
    text: status,
  };
}

function getUnitLabel(value: string) {
  return UNIT_OPTIONS.find((o) => o.value === value)?.label ?? value ?? "ш";
}

function formatDateTime(dt: string) {
  const d = new Date(dt);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderImplementationPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getOrderItemsForOrderProcess(orderId);
      setItems(data);
    } catch {
      toast.error("Өгөгдөл татахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const totalItems = items.length;
  const fullyCompleted = items.filter((item) => {
    const done = item.order_fulfillment
      .filter((f: any) => COMPLETED_STATUSES.includes(f.status?.toLowerCase()))
      .reduce((s: number, f: any) => s + Number(f.quantity || 0), 0);
    return item.final_quantity > 0 && done >= item.final_quantity;
  }).length;

  if (loading) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Захиалга руу буцах
        </Link>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
              Захиалга
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Захиалгын биелэлт</h1>
          </div>
          {totalItems > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:min-w-[160px]">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Нийт биелэлт</p>
                <p className="text-lg font-bold tabular-nums">
                  {fullyCompleted}
                  <span className="text-sm font-normal text-muted-foreground"> / {totalItems}</span>
                </p>
              </div>
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                fullyCompleted === totalItems ? "bg-emerald-100 text-emerald-700" : "bg-blue-50 text-blue-700"
              )}>
                {totalItems > 0 ? Math.round((fullyCompleted / totalItems) * 100) : 0}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Package className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-medium">Сэлбэг олдсонгүй</p>
          <p className="mt-1 text-sm text-muted-foreground">Энэ захиалганд биелэлт бүртгэх зүйл байхгүй байна</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <OrderItemCard key={item.id} item={item} orderId={orderId} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function OrderItemCard({
  item,
  orderId,
  onRefresh,
}: {
  item: any;
  orderId: string;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [qtyInput, setQtyInput] = useState("");
  const [notes, setNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("ordered");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pendingChange, setPendingChange] = useState<{ id: string; old: string; next: string } | null>(null);

  const unit = getUnitLabel(item.unit);

  const totalCompleted = item.order_fulfillment
    .filter((f: any) => COMPLETED_STATUSES.includes(f.status?.toLowerCase()))
    .reduce((s: number, f: any) => s + Number(f.quantity || 0), 0);

  const percent = item.final_quantity > 0
    ? Math.min(100, Math.round((totalCompleted / item.final_quantity) * 100))
    : 0;

  const toggleHistory = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    const qty = Number(qtyInput);
    if (!qty || qty <= 0) return toast.error("Зөв тоо оруулна уу");
    setIsAdding(true);
    try {
      await createFulfillment({
        orderItemId: item.id,
        quantity: qty,
        notes: notes.trim() || undefined,
        path: `/orders/${orderId}/implementation`,
        status: selectedStatus,
      });
      toast.success("Шинэ биелэлт бүртгэгдлээ");
      setQtyInput("");
      setNotes("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Алдаа гарлаа");
    } finally {
      setIsAdding(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingChange) return;
    try {
      await updateFulfillmentStatus({
        fulfillmentId: pendingChange.id,
        newStatus: pendingChange.next,
        oldStatus: pendingChange.old,
        reason: "Хэрэглэгч өөрчилсөн",
      });
      toast.success("Статус шинэчлэгдлээ");
      onRefresh();
    } catch {
      toast.error("Алдаа гарлаа");
    } finally {
      setPendingChange(null);
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
            <div className="min-w-0">
              <p className="font-semibold text-foreground leading-tight">{item.part_name}</p>
              {item.part_number && (
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.part_number}</p>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 sm:min-w-[200px]">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Биелэлт</span>
                <span className="font-semibold tabular-nums">
                  {totalCompleted} / {item.final_quantity} {unit}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    percent >= 100 ? "bg-emerald-500" :
                    percent >= 50  ? "bg-amber-500" :
                    "bg-primary"
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <div className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
              percent >= 100 ? "bg-emerald-100 text-emerald-700" :
              percent >= 50  ? "bg-amber-100 text-amber-700" :
              "bg-blue-50 text-blue-700"
            )}>
              {percent}%
            </div>
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
                    {item.order_fulfillment.map((f: any, idx: number) => {
                      const scfg = getStatusCfg(f.status);
                      const isOpen = expandedIds.has(f.id);
                      return (
                        <React.Fragment key={f.id}>
                          <tr
                            className="cursor-pointer transition-colors hover:bg-muted/20"
                            onClick={() => toggleHistory(f.id)}
                          >
                            <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold tabular-nums">
                              {f.quantity} <span className="font-normal text-muted-foreground">{unit}</span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={cn("gap-1 text-xs px-2 py-0.5", scfg.color)}>
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
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={f.status}
                                onValueChange={(next) => {
                                  if (next !== f.status) {
                                    setPendingChange({ id: f.id, old: f.status, next });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 w-36 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value} className="text-xs">
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={6} className="px-4 py-3 bg-muted/10 border-t border-border/40">
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
                {item.order_fulfillment.map((f: any) => {
                  const scfg = getStatusCfg(f.status);
                  const isOpen = expandedIds.has(f.id);
                  return (
                    <div key={f.id} className="rounded-lg border border-border/60 overflow-hidden">
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer"
                        onClick={() => toggleHistory(f.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold tabular-nums">
                              {f.quantity} {unit}
                            </span>
                            <Badge variant="outline" className={cn("gap-1 text-xs px-1.5 py-0", scfg.color)}>
                              {scfg.icon}
                              {scfg.text}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(f.created_at)}</p>
                          {f.notes && <p className="mt-0.5 text-xs text-muted-foreground">{f.notes}</p>}
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={f.status}
                            onValueChange={(next) => {
                              if (next !== f.status) {
                                setPendingChange({ id: f.id, old: f.status, next });
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value} className="text-xs">
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <ChevronDown className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform",
                          isOpen && "rotate-180"
                        )} />
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
              <ClipboardList className="mb-2 h-7 w-7 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Биелэлт бүртгэгдээгүй байна</p>
            </div>
          )}

          {/* Add fulfillment form */}
          <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Шинэ биелэлт нэмэх
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Тоо хэмжээ ({unit})
                </label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  className="h-9"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Статус
                </label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Тэмдэглэл
                </label>
                <Input
                  placeholder="Нэмэлт мэдээлэл..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <Button
              onClick={handleAdd}
              disabled={isAdding || !qtyInput.trim()}
              size="sm"
              className="mt-3"
            >
              <Plus className="h-4 w-4" />
              {isAdding ? "Хадгалж байна..." : "Биелэлт бүртгэх"}
            </Button>
          </div>
        </div>
      </section>

      {/* Status change confirmation dialog */}
      <AlertDialog open={!!pendingChange} onOpenChange={(open) => !open && setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Төлөв өөрчлөх</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange && (
                <>
                  Статусыг{" "}
                  <span className="font-semibold text-foreground">
                    {STATUS_OPTIONS.find((o) => o.value === pendingChange.old)?.label}
                  </span>{" "}
                  →{" "}
                  <span className="font-semibold text-foreground">
                    {STATUS_OPTIONS.find((o) => o.value === pendingChange.next)?.label}
                  </span>{" "}
                  болгож өөрчлөхдөө итгэлтэй байна уу?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>Тийм, өөрчлөх</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
        <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
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
