"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, GripVertical, MoreHorizontal, Truck } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { transitionPurchaseFulfillmentChunk } from "@/actions/order-purchases";
import type { PurchaseBatchRow } from "./types";
import { STATUS_BADGE_CONFIG } from "./purchase-status-badge-list";
import {
  formatQuantity,
  getNextFlowStatus,
  getPrevFlowStatus,
  getUnitLabel,
  PURCHASE_FLOW_ORDER,
  PURCHASE_MOVEMENT_LABELS,
} from "./utils";

type BoardCard = {
  chunkId: number;
  status: string;
  quantity: number;
  partName: string;
  partNumber?: string | null;
  unit: string;
  supplierName: string;
  reference?: string | null;
};

type MoveTarget = {
  card: BoardCard;
  toStatus: string;
};

function buildCards(batches: PurchaseBatchRow[]): BoardCard[] {
  const cards: BoardCard[] = [];
  for (const batch of batches) {
    const supplierName = batch.order_suppliers?.name ?? "Компани";
    for (const line of batch.order_purchase_lines ?? []) {
      const unit = getUnitLabel(line.order_items?.unit ?? "pcs");
      const partName = line.order_items?.part_name ?? "Бараа";
      const partNumber = line.order_items?.part_number;
      for (const chunk of line.order_fulfillment ?? []) {
        cards.push({
          chunkId: Number(chunk.id),
          status: String(chunk.status ?? "purchased").toLowerCase(),
          quantity: Number(chunk.quantity ?? 0),
          partName,
          partNumber,
          unit,
          supplierName,
          reference: batch.reference_number,
        });
      }
    }
  }
  return cards;
}

export function PurchaseFulfillmentBoard({
  orderId,
  batches,
  onRefresh,
}: {
  orderId: string;
  batches: PurchaseBatchRow[];
  onRefresh: () => void;
}) {
  const cards = useMemo(() => buildCards(batches), [batches]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [moveQuantity, setMoveQuantity] = useState("");
  const [moveNote, setMoveNote] = useState("");
  const [draggingCard, setDraggingCard] = useState<BoardCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const cardsByStatus = useMemo(() => {
    const map = new Map<string, BoardCard[]>();
    for (const status of PURCHASE_FLOW_ORDER) map.set(status, []);
    map.set("cancelled", []);
    for (const card of cards) {
      const bucket = map.get(card.status);
      if (bucket) bucket.push(card);
      else map.set(card.status, [card]);
    }
    return map;
  }, [cards]);

  const cancelledCards = cardsByStatus.get("cancelled") ?? [];

  const selectedAdvanceable = useMemo(
    () =>
      cards.filter(
        (card) => selected.has(card.chunkId) && getNextFlowStatus(card.status),
      ),
    [cards, selected],
  );

  const toggleSelect = (chunkId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  };

  const toggleColumn = (columnCards: BoardCard[], allSelected: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const card of columnCards) {
        if (allSelected) next.delete(card.chunkId);
        else next.add(card.chunkId);
      }
      return next;
    });
  };

  const runTransition = async (
    chunkId: number,
    toStatus: string,
    quantity: number,
    note: string,
  ) => {
    await transitionPurchaseFulfillmentChunk({
      fulfillmentId: chunkId,
      orderId: Number(orderId),
      status: toStatus,
      quantity,
      note,
    });
  };

  const advanceOne = async (card: BoardCard) => {
    const next = getNextFlowStatus(card.status);
    if (!next || busy) return;
    setBusy(true);
    try {
      await runTransition(
        card.chunkId,
        next,
        card.quantity,
        `${PURCHASE_MOVEMENT_LABELS[next]} рүү шилжүүлэв`,
      );
      toast.success(`${card.partName} → ${PURCHASE_MOVEMENT_LABELS[next]}`);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  const advanceSelected = async () => {
    if (selectedAdvanceable.length === 0 || busy) return;
    setBusy(true);
    let moved = 0;
    try {
      for (const card of selectedAdvanceable) {
        const next = getNextFlowStatus(card.status);
        if (!next) continue;
        await runTransition(
          card.chunkId,
          next,
          card.quantity,
          `Багц шилжүүлэлт: ${PURCHASE_MOVEMENT_LABELS[next]}`,
        );
        moved += 1;
      }
      toast.success(`${moved} мөр дараагийн шат руу шилжлээ`);
      setSelected(new Set());
      onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `${moved} мөр шилжсэн. Алдаа: ${error.message}`
          : "Алдаа гарлаа",
      );
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const openMoveDialog = (card: BoardCard, toStatus: string) => {
    setMoveTarget({ card, toStatus });
    setMoveQuantity(String(card.quantity));
    setMoveNote("");
  };

  const closeMoveDialog = () => {
    setMoveTarget(null);
    setMoveQuantity("");
    setMoveNote("");
  };

  const confirmMove = async () => {
    if (!moveTarget) return;
    const quantity = Number(moveQuantity);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > moveTarget.card.quantity
    ) {
      toast.error(
        `Шилжүүлэх тоо ${formatQuantity(moveTarget.card.quantity)}-ээс хэтрэхгүй байх ёстой`,
      );
      return;
    }
    setBusy(true);
    try {
      await runTransition(
        moveTarget.card.chunkId,
        moveTarget.toStatus,
        quantity,
        moveNote.trim() || `${PURCHASE_MOVEMENT_LABELS[moveTarget.toStatus]} рүү шилжүүлэв`,
      );
      toast.success("Төлөв шинэчлэгдлээ");
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Алдаа гарлаа");
    } finally {
      setBusy(false);
      closeMoveDialog();
    }
  };

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find((c) => c.chunkId === Number(event.active.id));
    if (card) setDraggingCard(card);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingCard(null);

    if (!over) return;
    if (busy) {
      toast.error("Өмнөх үйлдэл дуусаагүй байна. Түр хүлээнэ үү.");
      return;
    }

    const card = cards.find((c) => c.chunkId === Number(active.id));
    const toStatus = String(over.id);

    if (!card || card.status === toStatus) return;

    setBusy(true);
    try {
      await runTransition(
        card.chunkId,
        toStatus,
        card.quantity,
        `${PURCHASE_MOVEMENT_LABELS[toStatus] ?? toStatus} рүү шилжүүлэв`,
      );
      toast.success(`${card.partName} → ${PURCHASE_MOVEMENT_LABELS[toStatus] ?? toStatus}`);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (cards.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <BoardHeading />
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Truck className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-medium">Хүргэлтийн мөр алга</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Худалдан авалт бүртгэгдсэний дараа энд хөдөлгөөн хянана
          </p>
        </div>
      </section>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section className="flex flex-col gap-3">
        <BoardHeading />

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">
              {selected.size} мөр сонгосон
              {selectedAdvanceable.length < selected.size && (
                <span className="text-muted-foreground">
                  {" "}
                  ({selectedAdvanceable.length} нь шилжих боломжтой)
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
                disabled={busy}>
                Цэвэрлэх
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={advanceSelected}
                disabled={busy || selectedAdvanceable.length === 0}>
                <ArrowRight className="h-4 w-4" />
                Дараагийн шат руу зөөх
              </Button>
            </div>
          </div>
        )}

        {/* Columns */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PURCHASE_FLOW_ORDER.map((status) => {
            const columnCards = cardsByStatus.get(status) ?? [];
            const totalQuantity = columnCards.reduce(
              (sum, card) => sum + card.quantity,
              0,
            );
            const config = STATUS_BADGE_CONFIG[status];
            const Icon = config?.icon;
            const allSelected =
              columnCards.length > 0 &&
              columnCards.every((card) => selected.has(card.chunkId));

            return (
              <div
                key={status}
                className="flex w-[320px] shrink-0 flex-col rounded-xl border border-border bg-muted/20">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                        config?.className,
                      )}>
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {PURCHASE_MOVEMENT_LABELS[status]}
                    </Badge>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {columnCards.length}
                  </span>
                </div>

                {columnCards.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="hover:text-foreground"
                      onClick={() => toggleColumn(columnCards, allSelected)}>
                      {allSelected ? "Болих" : "Бүгдийг сонгох"}
                    </button>
                    <span className="tabular-nums">
                      {formatQuantity(totalQuantity)} {columnCards[0]?.unit}
                    </span>
                  </div>
                )}

                <DroppableZone status={status} isDragging={!!draggingCard}>
                  {columnCards.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground/60">
                      Хоосон
                    </p>
                  ) : (
                    columnCards.map((card) => (
                      <DraggableCard key={card.chunkId} card={card} disabled={busy}>
                        <BoardCardItem
                          card={card}
                          selected={selected.has(card.chunkId)}
                          busy={busy}
                          onToggleSelect={() => toggleSelect(card.chunkId)}
                          onAdvance={() => advanceOne(card)}
                          onMove={(toStatus) => openMoveDialog(card, toStatus)}
                        />
                      </DraggableCard>
                    ))
                  )}
                </DroppableZone>
              </div>
            );
          })}
        </div>

        {/* Cancelled */}
        {cancelledCards.length > 0 && (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                  STATUS_BADGE_CONFIG.cancelled?.className,
                )}>
                {PURCHASE_MOVEMENT_LABELS.cancelled}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {cancelledCards.length} мөр
              </span>
              <div className="flex flex-wrap gap-1.5">
                {cancelledCards.map((card) => (
                  <span
                    key={card.chunkId}
                    className="rounded-md border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">
                    {card.partName} · {formatQuantity(card.quantity)} {card.unit}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Move dialog (partial / back / cancel — via ⋯ menu) */}
        <AlertDialog
          open={!!moveTarget}
          onOpenChange={(open) => {
            if (!open) closeMoveDialog();
          }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Төлөв өөрчлөх</AlertDialogTitle>
              <AlertDialogDescription>
                {moveTarget && (
                  <>
                    <span className="font-semibold text-foreground">
                      {moveTarget.card.partName}
                    </span>{" "}
                    — {PURCHASE_MOVEMENT_LABELS[moveTarget.card.status]} →{" "}
                    <span className="font-semibold text-foreground">
                      {PURCHASE_MOVEMENT_LABELS[moveTarget.toStatus]}
                    </span>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Шилжүүлэх тоо</label>
                <Input
                  type="number"
                  min="0"
                  max={moveTarget?.card.quantity}
                  value={moveQuantity}
                  onChange={(event) => setMoveQuantity(event.target.value)}
                  placeholder="Тоо хэмжээ"
                />
                {moveTarget && (
                  <p className="text-xs text-muted-foreground">
                    Хамгийн ихдээ{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatQuantity(moveTarget.card.quantity)}{" "}
                      {moveTarget.card.unit}
                    </span>
                    . Бага тоо оруулбал үлдсэн нь хуучин төлөв дээрээ үлдэнэ.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Тайлбар</label>
                <Input
                  value={moveNote}
                  onChange={(event) => setMoveNote(event.target.value)}
                  placeholder="Тайлбар (заавал биш)..."
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Болих</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button type="button" onClick={confirmMove} disabled={busy}>
                  Шилжүүлэх
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      {/* Drag overlay — renders outside the scroll container */}
      <DragOverlay dropAnimation={{ duration: 120 }}>
        {draggingCard && (
          <div className="w-[244px] rotate-1 scale-105 opacity-95 shadow-xl">
            <CardGhost card={draggingCard} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ── Droppable column zone ─────────────────────────────────────────────────────

function DroppableZone({
  status,
  isDragging,
  children,
}: {
  status: string;
  isDragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-1 flex-col gap-2 rounded-b-xl p-2 transition-colors duration-100",
        isOver && "bg-primary/5 ring-2 ring-inset ring-primary/25",
        isDragging && !isOver && "ring-1 ring-inset ring-border/40",
      )}>
      {children}
    </div>
  );
}

// ── Draggable card wrapper ────────────────────────────────────────────────────

function DraggableCard({
  card,
  disabled,
  children,
}: {
  card: BoardCard;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.chunkId, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}>
      {/* Drag handle — passes listeners to children via slot */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ dragHandleProps?: object }>, {
            dragHandleProps: { ...attributes, ...listeners },
          })
        : children}
    </div>
  );
}

// ── Ghost card for DragOverlay ────────────────────────────────────────────────

function CardGhost({ card }: { card: BoardCard }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-card p-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{card.partName}</p>
          {card.partNumber && (
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {card.partNumber}
            </p>
          )}
          <p className="mt-0.5 text-xs font-semibold tabular-nums">
            {formatQuantity(card.quantity)}{" "}
            <span className="font-normal text-muted-foreground">{card.unit}</span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {card.supplierName}
            {card.reference ? ` · ${card.reference}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Board heading ─────────────────────────────────────────────────────────────

function BoardHeading() {
  return (
    <div className="flex items-center gap-2">
      <Truck className="h-4 w-4 text-muted-foreground" />
      <div>
        <h2 className="font-semibold">Хүргэлтийн явц</h2>
        <p className="text-xs text-muted-foreground">
          Картыг чирж өөр шат руу шууд зөөх, эсвэл товч ашиглан урагшлуул. Олныг
          сонгож багцаар зөөж болно.
        </p>
      </div>
    </div>
  );
}

// ── Board card ────────────────────────────────────────────────────────────────

function BoardCardItem({
  card,
  selected,
  busy,
  dragHandleProps,
  onToggleSelect,
  onAdvance,
  onMove,
}: {
  card: BoardCard;
  selected: boolean;
  busy: boolean;
  dragHandleProps?: object;
  onToggleSelect: () => void;
  onAdvance: () => void;
  onMove: (status: string) => void;
}) {
  const next = getNextFlowStatus(card.status);
  const prev = getPrevFlowStatus(card.status);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-2.5 shadow-sm transition-colors",
        selected ? "border-primary ring-1 ring-primary/30" : "border-border/60",
      )}>
      <div className="flex items-start gap-2">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label={`${card.partName} сонгох`}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">
            {card.partName}
          </p>
          {card.partNumber && (
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {card.partNumber}
            </p>
          )}
          <p className="mt-0.5 text-xs font-semibold tabular-nums">
            {formatQuantity(card.quantity)}{" "}
            <span className="font-normal text-muted-foreground">
              {card.unit}
            </span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {card.supplierName}
            {card.reference ? ` · ${card.reference}` : ""}
          </p>
        </div>
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="flex cursor-grab items-center justify-center rounded p-0.5 text-muted-foreground/30 hover:bg-muted/50 hover:text-muted-foreground/60 active:cursor-grabbing touch-none"
          aria-label="Чирэх">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {next ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 flex-1 justify-center gap-1 text-xs"
            disabled={busy}
            onClick={onAdvance}>
            <ArrowRight className="h-3.5 w-3.5" />
            {PURCHASE_MOVEMENT_LABELS[next]}
          </Button>
        ) : (
          <span className="flex-1 text-center text-[11px] font-medium text-emerald-600">
            Дууссан ✓
          </span>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              disabled={busy}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-1">
            {next && (
              <MenuButton onClick={() => onMove(next)}>
                Хэсэгчлэн зөөх ({PURCHASE_MOVEMENT_LABELS[next]})
              </MenuButton>
            )}
            {prev && (
              <MenuButton onClick={() => onMove(prev)}>
                Өмнөх шат руу буцаах ({PURCHASE_MOVEMENT_LABELS[prev]})
              </MenuButton>
            )}
            {card.status !== "cancelled" && (
              <MenuButton onClick={() => onMove("cancelled")} destructive>
                Цуцлах
              </MenuButton>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  destructive = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
        destructive && "text-red-600 hover:bg-red-50",
      )}>
      {children}
    </button>
  );
}
