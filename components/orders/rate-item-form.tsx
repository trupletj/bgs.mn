// components/orders/rate-item-form.tsx
"use client";

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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  MoreHorizontal,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { submitReview } from "@/actions/rate";
import ImageViewer from "@/components/image-viewer";
import { OrderItem, OrderStep, SubOrderItem } from "@/types/rate";
import { UNIT_OPTIONS } from "@/types";
import { UnitSpareDisplay } from "../unit-display";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

interface RateItemFormProps {
  orderItems: OrderItem[];
  currentStep: OrderStep;
  order_instance_id: number;
  reviewer_profile_id: number;
}

function getUnitLabel(unit: string) {
  return UNIT_OPTIONS.find((option) => option.value === unit)?.label || unit;
}

function formatHistoryDate(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function getHistoryStatusLabel(status: string) {
  const labels: Record<string, string> = {
    approved: "Зөвшөөрсөн",
    rejected: "Татгалзсан",
    changes_requested: "Өөрчилсөн",
    pending: "Хүлээгдсэн",
  };

  return labels[status] || status;
}

function getHistoryStatusBadgeClass(status: string) {
  const classes: Record<string, string> = {
    approved: "border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm",
    rejected: "border-red-200 bg-red-100 text-red-800 shadow-sm",
    changes_requested: "border-amber-300 bg-amber-100 text-amber-900 shadow-sm",
    pending: "border-slate-200 bg-slate-100 text-slate-700 shadow-sm",
    skipped: "border-zinc-200 bg-zinc-100 text-zinc-700 shadow-sm",
  };

  return classes[status] || "border-slate-200 bg-slate-100 text-slate-700";
}

function HistoryStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-semibold", getHistoryStatusBadgeClass(status))}>
      {getHistoryStatusLabel(status)}
    </Badge>
  );
}

function formatQty(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "-";

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return String(value);

  return Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(2).replace(/\.?0+$/, "");
}

function getHistoryReviewerName(historyItem: SubOrderItem) {
  const name = historyItem.reviewer_profile?.name || "Тодорхойгүй";
  return name.split("/")[0].trim();
}

function ItemImageCell({ item }: { item: OrderItem }) {
  if (!item.image_url) {
    return (
      <div className="flex size-16 items-center justify-center rounded-lg border border-dashed bg-muted/30 text-xs">
        Зураггүй
      </div>
    );
  }

  return (
    <div className="max-w-20 overflow-hidden rounded-lg [&_img]:object-cover flex justify-center">
      <ImageViewer images={[item.image_url]} />
    </div>
  );
}

function ReviewerInfoHover({
  historyItem,
  children,
}: {
  historyItem: SubOrderItem;
  children: React.ReactNode;
}) {
  const reviewer = historyItem.reviewer_profile;
  const reviewerName = getHistoryReviewerName(historyItem);

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>

      <HoverCardContent
        align="center"
        className="w-80 rounded-2xl border-slate-200 bg-white p-4 shadow-xl">
        <div className="space-y-2">
          <div className="px-2">
            <p className="text-lg font-semibold text-slate-950">
              {reviewerName}
            </p>

            {reviewer?.position_name && (
              <p className="mt-0.5 text-sm ">{reviewer.position_name}</p>
            )}
          </div>

          <div className=" text-xs grid grid-cols-2 gap-1">
            <div className="rounded-xl bg-slate-50 p-2 flex items-center gap-2">
              <p className="font-semibold">Өөрчилсөн тоо : </p>
              <p className=" font-mono text-sm font-semibold text-slate-950">
                {formatQty(historyItem.quantity)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-2 flex items-center gap-2">
              <p className="font-semibold">Төлөв:</p>
              <HistoryStatusBadge status={historyItem.status} />
            </div>
          </div>

          {historyItem.created_at && (
            <div className=" bg-slate-50 p-2 text-xs flex items-center gap-2">
              <p className="font-semibold">Огноо</p>
              <p className=" font-medium text-slate-800">
                {formatHistoryDate(historyItem.created_at)}
              </p>
            </div>
          )}

          {historyItem.description && (
            <div className="rounded-xl bg-slate-50 p-2">
              <p className="text-xs font-semibold">Тайлбар</p>
              <p className="mt-1 text-xs leading-5 ">
                {historyItem.description}
              </p>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function QtyHistoryNode({
  historyItem,
  onClick,
}: {
  historyItem: SubOrderItem;
  onClick?: () => void;
}) {
  return (
    <ReviewerInfoHover historyItem={historyItem}>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-24 shrink-0 flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex h-10 min-w-12 items-center justify-center rounded-lg bg-yellow-500 px-3 font-mono text-sm font-semibold text-gray-900 shadow-sm transition group-hover:bg-yellow-400">
          {formatQty(historyItem.quantity)}
        </div>

        <span className="mt-1 max-w-24 truncate text-[11px] text-muted-foreground group-hover:text-foreground">
          {getHistoryReviewerName(historyItem)}
        </span>
      </button>
    </ReviewerInfoHover>
  );
}

function QtyArrow() {
  return <ArrowRight className="mt-3 size-4 shrink-0 text-muted-foreground" />;
}

function QtyChangeHistory({
  item,
  history,
  value,
  isChanged,
  isSubmitting,
  onQuantityChange,
  onReset,
}: {
  item: OrderItem;
  history?: SubOrderItem[];
  value: string;
  isChanged: boolean;
  isSubmitting: boolean;
  onQuantityChange: (value: string) => void;
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const orderedHistory = [...(history || [])].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  });

  const latestHistory = orderedHistory[orderedHistory.length - 1];

  const canCollapse = orderedHistory.length > 2;
  const visibleHistory =
    expanded || !canCollapse
      ? orderedHistory
      : latestHistory
        ? [latestHistory]
        : [];

  const hiddenCount = canCollapse ? orderedHistory.length - 1 : 0;

  return (
    <div className="flex min-w-[360px] flex-col justify-center gap-2">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-start gap-2 py-1">
          {/* Original */}
          <div className="flex w-24 shrink-0 flex-col items-center">
            <div className="flex h-10 min-w-12 items-center justify-center rounded-lg bg-green-600 px-3 font-mono text-sm font-semibold text-white shadow-sm">
              {formatQty(item.quantity)}
            </div>
            <span className="mt-1 max-w-24 truncate text-[11px] text-muted-foreground">
              Анхны утга
            </span>
          </div>

          <QtyArrow />

          {/* Collapsed middle */}
          {canCollapse && !expanded && (
            <>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="group flex w-24 shrink-0 flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Өмнөх өөрчлөлтүүдийг дэлгэх">
                <div className="flex h-10 min-w-12 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-3 text-slate-600 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800">
                  <MoreHorizontal className="size-5" />
                </div>

                <span className="mt-1 text-[11px] text-muted-foreground group-hover:text-amber-800">
                  {hiddenCount} өөрчлөлт
                </span>
              </button>

              <QtyArrow />
            </>
          )}

          {/* Expanded/full history or latest only */}
          {visibleHistory.map((historyItem) => (
            <div key={historyItem.id} className="flex items-start gap-2">
              <QtyHistoryNode
                historyItem={historyItem}
                onClick={() => {
                  if (expanded && canCollapse) {
                    setExpanded(false);
                  }
                }}
              />
              <QtyArrow />
            </div>
          ))}

          {/* Current input */}
          <div className="flex w-32 shrink-0 flex-col items-center">
            <div
              className={cn(
                "flex h-10 w-32 items-center justify-center gap-1 rounded-lg border bg-white px-2 shadow-sm",
                isChanged && "border-amber-300 bg-amber-50",
              )}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(event) => onQuantityChange(event.target.value)}
                disabled={isSubmitting}
                className="h-8 w-20 border-0 bg-transparent p-0 text-center font-mono text-sm font-semibold shadow-none focus-visible:ring-0"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onReset}
                disabled={isSubmitting}
                className={cn(
                  "size-7 shrink-0 transition-none",
                  !isChanged && "invisible pointer-events-none",
                )}>
                <RotateCcw className="size-3.5" />
              </Button>
            </div>

            <span
              className={cn(
                "mt-1 max-w-28 truncate text-[11px] text-muted-foreground",
                isChanged && "font-medium text-amber-700",
              )}>
              Таны шийдвэр
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RateItemForm({
  orderItems,
  currentStep,
  order_instance_id,
  reviewer_profile_id,
}: RateItemFormProps) {
  const [comments, setComments] = useState("");
  const [newQuantities, setNewQuantities] = useState<Record<number, number>>(
    {},
  );
  const [quantityInputs, setQuantityInputs] = useState<Record<number, string>>(
    {},
  );
  const [itemComments, setItemComments] = useState<Record<number, string>>({});
  const [subOrderItems, setSubOrderItems] = useState<
    Record<number, SubOrderItem[]>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const hasChanges = Object.keys(newQuantities).length > 0;

  const changedCount = orderItems.filter((item) => {
    const changed = newQuantities[item.id];
    return changed !== undefined && changed !== item.quantity;
  }).length;

  const handleItemCommentChange = (itemId: number, value: string) => {
    setItemComments((prev) => ({ ...prev, [itemId]: value }));
  };

  const loadSubOrderItems = useCallback(async () => {
    try {
      const itemIds = orderItems.map((item) => item.id);
      if (itemIds.length === 0) return;

      const { data, error } = await supabase
        .from("sub_order_item")
        .select(
          `id, 
          order_item_id, 
          quantity, 
          status, 
          description, 
          created_at, 
          created_by, 
          reviewer_profile:profile!sub_order_item_reviewer_profile_id_fkey( name, position_name )`,
        )
        .in("order_item_id", itemIds)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const grouped: Record<number, SubOrderItem[]> = {};
      data?.forEach((item) => {
        if (!grouped[item.order_item_id]) {
          grouped[item.order_item_id] = [];
        }
        grouped[item.order_item_id].push(item as unknown as SubOrderItem);
      });

      setSubOrderItems(grouped);
    } catch (error) {
      console.error("Error loading sub order items:", error);
    }
  }, [orderItems, supabase]);

  useEffect(() => {
    loadSubOrderItems();
  }, [loadSubOrderItems]);

  const handleQuantityChange = (itemId: number, value: string) => {
    setQuantityInputs((prev) => ({
      ...prev,
      [itemId]: value,
    }));

    const original =
      orderItems.find((item) => item.id === itemId)?.quantity ?? 0;

    const trimmedValue = value.trim();

    if (trimmedValue === "") {
      setNewQuantities((prev) => {
        const rest = { ...prev };
        delete rest[itemId];
        return rest;
      });
      return;
    }

    const num = Number(trimmedValue);

    if (!Number.isFinite(num)) {
      setNewQuantities((prev) => {
        const rest = { ...prev };
        delete rest[itemId];
        return rest;
      });
      return;
    }

    setNewQuantities((prev) => {
      if (num === original) {
        const rest = { ...prev };
        delete rest[itemId];
        return rest;
      }

      return {
        ...prev,
        [itemId]: num,
      };
    });
  };

  const handleQuantityReset = (item: OrderItem) => {
    setQuantityInputs((prev) => {
      const rest = { ...prev };
      delete rest[item.id];
      return rest;
    });

    setNewQuantities((prev) => {
      const rest = { ...prev };
      delete rest[item.id];
      return rest;
    });
  };

  const handleSubmit = async (
    status: "approved" | "rejected" | "changes_requested",
  ) => {
    setIsSubmitting(true);

    const result = await submitReview({
      order_instance_id,
      order_step_id: currentStep.id,
      status,
      comments: comments.trim(),
      newQuantities: status === "changes_requested" ? newQuantities : undefined,
      reviewer_profile_id,
      itemComments: status === "changes_requested" ? itemComments : undefined,
    });

    if (result.success) {
      toast.success(
        status === "approved"
          ? "Зөвшөөрлөө"
          : status === "rejected"
            ? "Татгалзлаа"
            : "Өөрчлөлт шаардлаа",
      );
      router.push("/orders");
    } else {
      toast.error(result.error || "Алдаа гарлаа");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>Сэлбэгийн үнэлгээ</CardTitle>
              <p className="mt-1 text-sm ">
                Тоо хэмжээг нягталж, шаардлагатай бол мөр тус бүрт тайлбар
                үлдээнэ.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Нийт {orderItems.length}</Badge>
              <Badge
                className={cn(
                  "border border-slate-200 bg-slate-100 text-slate-700 shadow-sm",
                  changedCount > 0 &&
                    "border-amber-300 bg-amber-500 text-white shadow-md hover:bg-amber-500",
                )}>
                Өөрчилсөн {changedCount}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/90">
                  <TableHead className="w-[24%] px-4 text-xs font-bold uppercase tracking-wide text-slate-800">
                    Сэлбэгийн нэр
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide text-slate-800">
                    Зураг
                  </TableHead>
                  <TableHead className="w-[34%] text-xs font-bold uppercase tracking-wide text-slate-800">
                    Тоо хэмжээний өөрчлөлт
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide text-slate-800">
                    Нэгж
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wide text-slate-800">
                    Төрөл
                  </TableHead>
                  <TableHead className="w-[22%] text-xs font-bold uppercase tracking-wide text-slate-800">
                    Тайлбар
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.map((item) => {
                  const changed = newQuantities[item.id];
                  const isChanged =
                    changed !== undefined && changed !== item.quantity;
                  const unitLabel = getUnitLabel(item.unit);

                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "align-middle",
                        isChanged &&
                          "border-l-4 border-l-amber-500 bg-amber-50/40 hover:bg-amber-50/60",
                      )}>
                      <TableCell className="px-4 whitespace-normal">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{item.part_name}</p>
                          </div>
                          {item.part_number && (
                            <p className="mt-1 font-mono text-xs ">
                              Эдийн дугаар: {item.part_number}
                            </p>
                          )}
                          {(item.part_description || item.notes) && (
                            <p className="mt-1 line-clamp-2 text-xs ">
                              Тайлбар: {item.part_description || item.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ItemImageCell item={item} />
                      </TableCell>
                      <TableCell className="whitespace-normal align-middle">
                        <div className="flex items-center py-3">
                          <QtyChangeHistory
                            item={item}
                            history={subOrderItems[item.id]}
                            value={
                              quantityInputs[item.id] ??
                              String(changed ?? item.quantity)
                            }
                            isChanged={isChanged}
                            isSubmitting={isSubmitting}
                            onQuantityChange={(value) =>
                              handleQuantityChange(item.id, value)
                            }
                            onReset={() => handleQuantityReset(item)}
                          />
                        </div>
                      </TableCell>
                      <TableCell>{unitLabel}</TableCell>
                      <TableCell>
                        <UnitSpareDisplay unit={item.spare_type} />
                      </TableCell>

                      <TableCell className="whitespace-normal">
                        <Textarea
                          placeholder="Мөрийн тайлбар..."
                          className="min-h-20 bg-white"
                          value={itemComments[item.id] || ""}
                          onChange={(event) =>
                            handleItemCommentChange(item.id, event.target.value)
                          }
                          disabled={!isChanged || isSubmitting}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 p-4 lg:hidden">
            {orderItems.map((item) => {
              const changed = newQuantities[item.id];
              const isChanged =
                changed !== undefined && changed !== item.quantity;
              const unitLabel = getUnitLabel(item.unit);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-2xl border bg-white p-4 shadow-xs",
                    isChanged && "border-amber-200 bg-amber-50/50",
                  )}>
                  <div className="flex gap-3">
                    <ItemImageCell item={item} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.part_name}</p>
                        {isChanged && (
                          <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                            Өөрчилсөн
                          </Badge>
                        )}
                      </div>
                      {item.part_number && (
                        <p className="font-mono text-xs ">{item.part_number}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs ">
                        <span>{unitLabel}</span>
                        <span>·</span>
                        <UnitSpareDisplay unit={item.spare_type} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border bg-white p-3">
                    <p className="mb-2 text-xs font-medium ">
                      Тоо хэмжээний өөрчлөлт
                    </p>

                    <QtyChangeHistory
                      item={item}
                      history={subOrderItems[item.id]}
                      value={
                        quantityInputs[item.id] ??
                        String(changed ?? item.quantity)
                      }
                      isChanged={isChanged}
                      isSubmitting={isSubmitting}
                      onQuantityChange={(value) =>
                        handleQuantityChange(item.id, value)
                      }
                      onReset={() => handleQuantityReset(item)}
                    />
                  </div>

                  <div className="mt-4">
                    <Textarea
                      placeholder="Мөрийн тайлбар..."
                      className="min-h-20 bg-white"
                      value={itemComments[item.id] || ""}
                      onChange={(event) =>
                        handleItemCommentChange(item.id, event.target.value)
                      }
                      disabled={!isChanged || isSubmitting}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {orderItems.length === 0 && (
            <div className="flex min-h-40 items-center justify-center text-sm ">
              Сэлбэг олдсонгүй.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Эцсийн шийдвэр</CardTitle>
          <p className="text-sm ">
            Ерөнхий тайлбар нь захиалга гаргагч болон дараагийн оролцогчдод
            харагдана.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Санал, шалтгаан, өөрчлөлтийн тайлбар..."
            rows={5}
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            disabled={isSubmitting}
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 rounded-2xl border bg-white/95 p-4 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 text-sm">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-full",
                hasChanges
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700",
              )}>
              {hasChanges ? (
                <MessageSquare className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
            </div>
            <div>
              <p className="font-medium">
                {hasChanges
                  ? `${changedCount} мөр өөрчлөгдсөн`
                  : "Өөрчлөлт ороогүй"}
              </p>
              <p className="">
                {hasChanges
                  ? "Өөрчлөлт шаардах үйлдэл илгээгдэнэ."
                  : "Зөвшөөрөхөд бэлэн байна."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => setRejectDialogOpen(true)}
              disabled={isSubmitting}
              variant="destructive"
              className="min-w-36">
              <XCircle className="size-4" />
              {isSubmitting ? "Илгээж байна..." : "Татгалзах"}
            </Button>

            {hasChanges ? (
              <Button
                onClick={() => handleSubmit("changes_requested")}
                disabled={isSubmitting}
                variant="outline"
                className="min-w-44 border-amber-500 text-amber-700 hover:bg-amber-50">
                <MessageSquare className="size-4" />
                {isSubmitting ? "Илгээж байна..." : "Өөрчлөлт шаардах"}
              </Button>
            ) : (
              <Button
                onClick={() => handleSubmit("approved")}
                disabled={isSubmitting}
                className="min-w-36 bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="size-4" />
                {isSubmitting ? "Илгээж байна..." : "Зөвшөөрөх"}
              </Button>
            )}
          </div>
          <AlertDialog
            open={rejectDialogOpen}
            onOpenChange={setRejectDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Татгалзахдаа итгэлтэй байна уу?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Та ерөнхий тайлбар хэсэгт татгалзах шалтгаанаа бичээрэй.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>
                  Болих
                </AlertDialogCancel>

                <AlertDialogAction
                  disabled={isSubmitting}
                  onClick={() => handleSubmit("rejected")}
                  className="bg-red-600 text-white hover:bg-red-700">
                  {isSubmitting ? "Илгээж байна..." : "Тийм, татгалзах"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
