"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Building2,
  ArrowLeftRight,
  X,
  Pencil,
  CheckCircle2,
  Inbox,
  CornerUpLeft,
  UserCog,
  MapPin,
  Briefcase,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { UserSearchPicker } from "@/components/users/user-search-picker";
import {
  addInternalPassenger,
  bulkTransferPassengers,
  bulkUnassignToPool,
  getAssignments,
  linkAssignmentsAsCompanions,
  removePassenger,
  setBusTripLeader,
  setPassengersConfirmed,
  transferPassenger,
  unassignToPool,
  unlinkAssignmentsFromCompanions,
  type BusLeaderRow,
} from "@/actions/shift-exchange";
import type {
  AutobusDirection,
  BusWithStats,
  PassengerAssignment,
} from "@/types/shift-exchange";
import { BusForm } from "@/components/shift-exchange/bus-form";
import { BusyIndicator } from "@/components/ui/page-loader";
import {
  DirectionBadge,
  passengerCapacity,
} from "@/components/shift-exchange/shared";
import { AlertTriangle } from "lucide-react";

interface Props {
  exchangeId: number;
  exchangeName?: string | null;
  exchangeDate?: string | null;
  bus: BusWithStats;
  leader: BusLeaderRow | null;
  assignments: PassengerAssignment[];
  poolAssignments: PassengerAssignment[];
  otherBuses: BusWithStats[];
  directions: AutobusDirection[];
  canAdmin: boolean;
}

export function AssignmentBoard({
  exchangeId,
  exchangeName,
  exchangeDate,
  leader,
  bus,
  assignments,
  poolAssignments,
  otherBuses,
  directions,
  canAdmin,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const assignedUserIds = useMemo(
    () => assignments.map((a) => a.internalUserId),
    [assignments],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) =>
      [
        a.displayName,
        a.albaName,
        a.heltesName,
        a.organizationName,
        a.directionName,
        a.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [assignments, search]);

  const seatLimit = passengerCapacity(bus.capacity); // ахлахын 1 суудал нөөцилсөн
  const pct = seatLimit
    ? Math.round((bus.passengerCount / seatLimit) * 100)
    : 0;
  const isFull = bus.passengerCount >= seatLimit;
  const noLeader = !bus.tripLeaderId;
  const refresh = () => router.refresh();

  // single add (internal)
  const [addOpen, setAddOpen] = useState(false);
  const onAddInternal = (userId: string) =>
    startTransition(async () => {
      const res = await addInternalPassenger(bus.id, userId);
      if (res.ok) {
        toast.success("Нэмэгдлээ");
        refresh();
      } else toast.error(res.error);
    });

  // bus edit (inline dialog)
  const [editOpen, setEditOpen] = useState(false);

  // trip leader
  const [leaderOpen, setLeaderOpen] = useState(false);
  const onSetLeader = (userId: string | null) =>
    startTransition(async () => {
      const res = await setBusTripLeader(bus.id, exchangeId, userId);
      if (res.ok) {
        toast.success(userId ? "Ахлах солигдлоо" : "Ахлах хасагдлаа");
        setLeaderOpen(false);
        refresh();
      } else toast.error(res.error);
    });

  // remove
  const [toRemove, setToRemove] = useState<PassengerAssignment | null>(null);
  const onRemove = (force: boolean) => {
    if (!toRemove) return;
    startTransition(async () => {
      const res = await removePassenger(toRemove.id, bus.id, exchangeId, force);
      if (res.ok) {
        toast.success("Хасагдлаа");
        setToRemove(null);
        refresh();
      } else toast.error(res.error);
    });
  };

  // transfer
  const [toTransfer, setToTransfer] = useState<PassengerAssignment | null>(
    null,
  );
  const [transferTarget, setTransferTarget] = useState<string>("");
  const onTransfer = () => {
    if (!toTransfer || !transferTarget) return;
    startTransition(async () => {
      const res = await transferPassenger(
        toTransfer.id,
        Number(transferTarget),
        exchangeId,
        bus.id,
      );
      if (res.ok) {
        toast.success("Шилжүүллээ");
        setToTransfer(null);
        setTransferTarget("");
        refresh();
      } else toast.error(res.error);
    });
  };

  // unassign to pool
  const onUnassign = (a: PassengerAssignment) =>
    startTransition(async () => {
      const res = await unassignToPool(a.id, exchangeId, bus.id);
      if (res.ok) {
        toast.success("Хуваарилалтыг цуцаллаа");
        refresh();
      } else toast.error(res.error);
    });

  // ── multi-select bulk operations ──────────────────────────────────────────
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const filteredIds = useMemo(() => filtered.map((a) => a.id), [filtered]);
  const allSelected =
    filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  // сонгосон дотор companion бүлэгтэй хүн байгаа эсэх (Холбоо салгах идэвхжүүлэхэд)
  const anyLinkedSelected = useMemo(
    () =>
      assignments.some((a) => selected.has(a.id) && a.companionGroupId != null),
    [assignments, selected],
  );
  const clearSelection = () => setSelected(new Set());
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filteredIds));
  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const [bulkUnassignOpen, setBulkUnassignOpen] = useState(false);
  const onBulkUnassign = () =>
    startTransition(async () => {
      const res = await bulkUnassignToPool([...selected], exchangeId, bus.id);
      if (res.ok) {
        toast.success(`${res.count} зорчигч хуваарилаагүй жагсаалт руу буцлаа`);
        clearSelection();
        setBulkUnassignOpen(false);
        refresh();
      } else toast.error(res.error);
    });

  const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState("");
  const onBulkTransfer = () => {
    if (!bulkTarget) return;
    startTransition(async () => {
      const res = await bulkTransferPassengers(
        [...selected],
        Number(bulkTarget),
        exchangeId,
        bus.id,
      );
      if (res.ok) {
        toast.success(
          `${res.transferred} зорчигч шилжлээ` +
            (res.skippedCapacity > 0
              ? ` · ${res.skippedCapacity} багтсангүй`
              : ""),
        );
        clearSelection();
        setBulkTarget("");
        setBulkTransferOpen(false);
        refresh();
      } else toast.error(res.error);
    });
  };

  const onBulkSetConfirmed = (confirmed: boolean) =>
    startTransition(async () => {
      const res = await setPassengersConfirmed(
        [...selected],
        confirmed,
        exchangeId,
        bus.id,
      );
      if (res.ok) {
        toast.success(
          confirmed
            ? `${res.count} зорчигч QR уншсан болголоо`
            : `${res.count} зорчигч QR уншаагүй болголоо`,
        );
        clearSelection();
        refresh();
      } else toast.error(res.error);
    });

  // companion бүлэг — сонгосон хүмүүсийг шууд хамт холбох / салгах
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkName, setLinkName] = useState("");
  const onLink = () =>
    startTransition(async () => {
      const res = await linkAssignmentsAsCompanions(
        [...selected],
        linkName,
        exchangeId,
        bus.id,
      );
      if (res.ok) {
        toast.success("Хамт холбогдлоо — цаашид нэг автобусанд явна");
        setLinkOpen(false);
        setLinkName("");
        clearSelection();
        refresh();
      } else toast.error(res.error);
    });
  const onUnlink = () =>
    startTransition(async () => {
      const res = await unlinkAssignmentsFromCompanions(
        [...selected],
        exchangeId,
        bus.id,
      );
      if (res.ok) {
        toast.success(`${res.count} зорчигчийн холбоо салгагдлаа`);
        clearSelection();
        refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-4">
      <BusyIndicator busy={pending} />
      {/* header */}
      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href={`/shift-exchange/${exchangeId}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline">
              ← {exchangeName ?? "Ээлж"}
              {exchangeDate && (
                <span className="tabular-nums">· {exchangeDate}</span>
              )}
            </Link>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{bus.name}</h1>
              <DirectionBadge direction={bus.direction} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {bus.directions.map((d) => d.name).join(" → ") || "Чиглэлгүй"}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <UserCog className="h-3.5 w-3.5" />
              <span>
                Ахлах:{" "}
                <span className="text-foreground">
                  {bus.tripLeaderName ?? "—"}
                </span>
              </span>
              {canAdmin && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Ахлах солих"
                  onClick={() => setLeaderOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="min-w-48 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium tabular-nums">
                {bus.passengerCount} / {seatLimit}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  зорчигч +1 ахлах
                </span>
              </span>
              <span className="text-xs text-emerald-600">
                ✓ {bus.confirmedCount}
              </span>
            </div>
            <Progress value={pct} />
            {canAdmin && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1 h-3 w-3" />
                Автобус засах
              </Button>
            )}
          </div>
        </div>

        {noLeader && (
          <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              Энэ автобусанд аялалын ахлах оноогоогүй байна. Заавал нэг ахлах
              оноох шаардлагатай.
            </span>
            {canAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="border-rose-300 text-rose-700 hover:bg-rose-100"
                onClick={() => setLeaderOpen(true)}>
                <UserCog className="h-4 w-4" />
                Ахлах оноох
              </Button>
            )}
          </div>
        )}

        {canAdmin && (
          <div className="flex flex-wrap gap-2">
            <PoolDialog
              pool={poolAssignments}
              busId={bus.id}
              exchangeId={exchangeId}
              isFull={isFull}
              remaining={Math.max(seatLimit - bus.passengerCount, 0)}
              onDone={refresh}
            />
            {otherBuses.length > 0 && (
              <FromOtherBusesDialog
                otherBuses={otherBuses}
                targetBusId={bus.id}
                exchangeId={exchangeId}
                isFull={isFull}
                remaining={Math.max(seatLimit - bus.passengerCount, 0)}
                onDone={refresh}
              />
            )}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Хүн нэмэх
              </Button>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Ажилтан нэмэх</DialogTitle>
                  <DialogDescription>
                    Нэр, утас, албан тушаалаар хайна
                  </DialogDescription>
                </DialogHeader>
                <UserSearchPicker
                  autoFocus
                  excludeIds={assignedUserIds}
                  disabled={pending || isFull}
                  onSelect={(u) => {
                    onAddInternal(u.id);
                    setAddOpen(false);
                  }}
                />
                {isFull && (
                  <p className="text-xs text-destructive">
                    Автобус дүүрсэн байна
                  </p>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}
      </Card>

      {/* search */}
      <Card className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Зорчигч хайх..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {/* bulk action bar */}
      {canAdmin && selected.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-row flex-wrap items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Badge variant="secondary" className="tabular-nums">
            {selected.size} сонгосон
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground"
            onClick={clearSelection}>
            <X className="h-3.5 w-3.5" />
            Цуцлах
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            disabled={pending}
            onClick={() => onBulkSetConfirmed(true)}>
            <CheckCircle2 className="h-4 w-4" />
            QR уншсан болгох
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={pending}
            onClick={() => onBulkSetConfirmed(false)}>
            <X className="h-4 w-4" />
            Уншаагүй болгох
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={pending || selected.size < 2}
            onClick={() => setLinkOpen(true)}>
            <Users className="h-4 w-4" />
            Хамт холбох
          </Button>
          {anyLinkedSelected && (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={pending}
              onClick={onUnlink}>
              <X className="h-4 w-4" />
              Холбоо салгах
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={pending}
            onClick={() => setBulkUnassignOpen(true)}>
            <CornerUpLeft className="h-4 w-4" />
            Хуваарилаагүй руу буцаах
          </Button>
          {otherBuses.length > 0 && (
            <Button
              size="sm"
              className="h-8"
              disabled={pending}
              onClick={() => setBulkTransferOpen(true)}>
              <ArrowLeftRight className="h-4 w-4" />
              Шилжүүлэх
            </Button>
          )}
        </div>
      )}

      {/* list */}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {canAdmin && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Бүгдийг сонгох"
                  />
                </TableHead>
              )}
              <TableHead className="w-10">#</TableHead>
              <TableHead className="w-56">Нэр</TableHead>
              <TableHead>Алба / Хэлтэс</TableHead>
              <TableHead>Албан тушаал</TableHead>
              <TableHead className="w-28">Чиглэл</TableHead>
              {canAdmin && (
                <TableHead className="w-28 text-right">Үйлдэл</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Аялалын ахлах = 1 дэх зорчигч */}
            {leader && (
              <TableRow className="bg-amber-50/60 hover:bg-amber-50/60">
                {canAdmin && <TableCell />}
                <TableCell className="text-muted-foreground tabular-nums">
                  1
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground">
                      {leader.displayName}
                    </span>
                    <Badge className="gap-1 border-transparent bg-amber-100 text-[11px] text-amber-800">
                      <UserCog className="h-3 w-3" />
                      Аялалын ахлах
                    </Badge>
                  </div>
                  {leader.phone && (
                    <span className="text-xs text-muted-foreground">
                      {leader.phone}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  <span className="text-foreground">
                    {leader.albaOrHeltes ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {leader.positionName ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {leader.directionName ?? "—"}
                </TableCell>
                {canAdmin && <TableCell />}
              </TableRow>
            )}
            {filtered.length === 0
              ? !leader && (
                  <TableRow>
                    <TableCell
                      colSpan={canAdmin ? 7 : 5}
                      className="py-10 text-center text-sm text-muted-foreground">
                      Зорчигч алга
                    </TableCell>
                  </TableRow>
                )
              : filtered.map((a, i) => (
                  <TableRow
                    key={a.id}
                    data-state={selected.has(a.id) ? "selected" : undefined}>
                    {canAdmin && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(a.id)}
                          onCheckedChange={() => toggleOne(a.id)}
                          aria-label={`${a.displayName} сонгох`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground tabular-nums">
                      {i + 1 + (leader ? 1 : 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{a.displayName}</span>
                        {a.isConfirmed && (
                          <CheckCircle2
                            className="h-4 w-4 text-emerald-600"
                            aria-label="QR баталгаажсан"
                          />
                        )}
                        {a.companionGroupName && (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-[11px]">
                            <Users className="h-3 w-3" />
                            {a.companionGroupName}
                          </Badge>
                        )}
                      </div>
                      {a.phone && (
                        <span className="text-xs text-muted-foreground">
                          {a.phone}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-foreground">
                        {a.albaName ?? a.heltesName ?? "—"}
                      </span>
                      {a.organizationName && (
                        <span className="block text-xs text-muted-foreground">
                          {a.organizationName}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.positionName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.directionName ?? "—"}
                    </TableCell>
                    {canAdmin && (
                      <TableCell className="text-right">
                        {selected.size === 0 && (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Энэ автобусанд хуваарилахаа болих"
                              onClick={() => onUnassign(a)}>
                              <CornerUpLeft className="h-4 w-4" />
                            </Button>
                            {otherBuses.length > 0 && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Шилжүүлэх"
                                onClick={() => setToTransfer(a)}>
                                <ArrowLeftRight className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Энэ ээлжинд ирэх хүмүүсийн жагсаалтаас хасах"
                              onClick={() => setToRemove(a)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </Card>

      {/* remove confirm */}
      <AlertDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Зорчигч хасах уу?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove?.displayName}
              {toRemove?.isConfirmed
                ? " — Энэ зорчигч QR-аар баталгаажсан байна. Хасахдаа итгэлтэй байна уу?"
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onRemove(!!toRemove?.isConfirmed)}>
              Хасах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* transfer */}
      <Dialog
        open={!!toTransfer}
        onOpenChange={(o) => !o && setToTransfer(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Автобус хооронд шилжүүлэх</DialogTitle>
            <DialogDescription>{toTransfer?.displayName}</DialogDescription>
          </DialogHeader>
          {toTransfer?.isConfirmed && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Энэ зорчигч баталгаажсан байна — шилжүүлэхдээ болгоомжтой.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Зорилтот автобус</Label>
            <Select value={transferTarget} onValueChange={setTransferTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Сонгох..." />
              </SelectTrigger>
              <SelectContent>
                {otherBuses.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name} ({b.passengerCount}/{passengerCapacity(b.capacity)}
                    )
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToTransfer(null)}>
              Болих
            </Button>
            <Button onClick={onTransfer} disabled={!transferTarget || pending}>
              Шилжүүлэх
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* bulk unassign confirm */}
      <AlertDialog open={bulkUnassignOpen} onOpenChange={setBulkUnassignOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Хуваарилаагүй руу буцаах уу?</AlertDialogTitle>
            <AlertDialogDescription>
              Сонгосон {selected.size} зорчигчийг энэ автобуснаас хасаж
              Хуваарилаагүй зорчигчид руу буцаана. Дараа нь дахин хуваарилж
              болно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction onClick={onBulkUnassign}>
              Хуваарилаагүй руу буцаах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* bulk transfer */}
      <Dialog open={bulkTransferOpen} onOpenChange={setBulkTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Олноор шилжүүлэх</DialogTitle>
            <DialogDescription>
              Сонгосон {selected.size} зорчигчийг өөр автобус руу шилжүүлнэ.
              Багтаамжид багтахгүй бол үлдэгсэд хэвээр үлдэнэ.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Зорилтот автобус</Label>
            <Select value={bulkTarget} onValueChange={setBulkTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Сонгох..." />
              </SelectTrigger>
              <SelectContent>
                {otherBuses.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name} ({b.passengerCount}/{passengerCapacity(b.capacity)}
                    )
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkTransferOpen(false)}>
              Болих
            </Button>
            <Button onClick={onBulkTransfer} disabled={!bulkTarget || pending}>
              Шилжүүлэх
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* companion link */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Хамт холбох</DialogTitle>
            <DialogDescription>
              Сонгосон {selected.size} зорчигчийг нэг хамтрагч бүлэг болгоно.
              Цаашид ухаалаг хуваарилалт тэднийг (ижил чиглэлд) нэг автобусанд
              хадгална.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Бүлгийн нэр (заавал биш)</Label>
            <Input
              autoFocus
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="Жишээ: Батын гэр бүл"
              onKeyDown={(e) => e.key === "Enter" && onLink()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Болих
            </Button>
            <Button onClick={onLink} disabled={pending || selected.size < 2}>
              Холбох
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* edit bus (inline) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Автобус засах</DialogTitle>
            <DialogDescription>
              Хөдлөх цаг, багтаамж, нэр зэрэг мэдээллийг засна
            </DialogDescription>
          </DialogHeader>
          <BusForm
            exchangeId={exchangeId}
            directions={directions}
            initial={bus}
            onDone={() => {
              setEditOpen(false);
              refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* change trip leader */}
      <Dialog open={leaderOpen} onOpenChange={setLeaderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Аялалын ахлах</DialogTitle>
            <DialogDescription>
              Одоогийн ахлах: {bus.tripLeaderName ?? "—"}
            </DialogDescription>
          </DialogHeader>
          <UserSearchPicker
            autoFocus
            placeholder="Шинэ ахлах хайх..."
            disabled={pending}
            onSelect={(u) => onSetLeader(u.id)}
          />
          {bus.tripLeaderId && (
            <DialogFooter>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => onSetLeader(null)}>
                <X className="h-4 w-4" />
                Ахлахыг хасах
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── assign from the unassigned list (pool), grouped by company ──────────────────
// ── add passengers pulled FROM another bus ──────────────────────────────────
function FromOtherBusesDialog({
  otherBuses,
  targetBusId,
  exchangeId,
  isFull,
  remaining,
  onDone,
}: {
  otherBuses: BusWithStats[];
  targetBusId: number;
  exchangeId: number;
  isFull: boolean;
  remaining: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sourceBusId, setSourceBusId] = useState("");
  const [loading, setLoading] = useState(false);
  const [passengers, setPassengers] = useState<PassengerAssignment[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");

  const loadBus = (busId: string) => {
    setSourceBusId(busId);
    setSelected(new Set());
    setQuery("");
    setPassengers([]);
    if (!busId) return;
    setLoading(true);
    getAssignments(Number(busId))
      .then(setPassengers)
      .finally(() => setLoading(false));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return passengers;
    return passengers.filter((p) =>
      [p.displayName, p.directionName, p.positionName, p.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [passengers, query]);

  const allSel =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected(allSel ? new Set() : new Set(filtered.map((p) => p.id)));
  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const reset = () => {
    setSourceBusId("");
    setPassengers([]);
    setSelected(new Set());
    setQuery("");
  };

  const add = () => {
    if (selected.size === 0 || !sourceBusId) return;
    startTransition(async () => {
      const res = await bulkTransferPassengers(
        [...selected],
        targetBusId,
        exchangeId,
        Number(sourceBusId),
      );
      if (res.ok) {
        toast.success(
          `${res.transferred} зорчигч нэмэгдлээ` +
            (res.skippedCapacity > 0
              ? ` · ${res.skippedCapacity} багтсангүй`
              : ""),
        );
        setSelected(new Set());
        loadBus(sourceBusId); // эх жагсаалтыг шинэчилнэ
        onDone();
        if (res.skippedCapacity === 0) setOpen(false);
      } else toast.error(res.error);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ArrowLeftRight className="h-4 w-4" />
        Бусад автобуснаас нэмэх
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Бусад автобуснаас нэмэх</DialogTitle>
          <DialogDescription>
            Автобус сонгоод зорчигчдыг нь энэ автобусанд шилжүүлнэ. Сул суудал:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {remaining}
            </span>
          </DialogDescription>
        </DialogHeader>

        <Select value={sourceBusId} onValueChange={loadBus}>
          <SelectTrigger>
            <SelectValue placeholder="Автобус сонгох..." />
          </SelectTrigger>
          <SelectContent>
            {otherBuses.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.name} ({b.passengerCount} зорчигч)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {sourceBusId && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Нэр, чиглэлээр шүүх..."
              className="pl-9"
            />
          </div>
        )}

        {!sourceBusId ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Дээрээс автобус сонгоно уу
          </p>
        ) : loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ачаалж байна...
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Зорчигч алга
          </p>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={allSel} onCheckedChange={toggleAll} />
              Бүгдийг сонгох
            </label>
            {filtered.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={selected.has(m.id)}
                  onCheckedChange={() => toggleOne(m.id)}
                />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">
                    {m.displayName || "Нэргүй"}
                  </span>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {m.directionName ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {m.directionName}
                      </span>
                    ) : (
                      <span className="text-amber-600">чиглэлгүй</span>
                    )}
                    {(m.albaName ?? m.heltesName) && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3 shrink-0" />
                        {m.albaName ?? m.heltesName}
                      </span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter className="items-center">
          {isFull && (
            <p className="mr-auto text-xs text-destructive">
              Автобус дүүрсэн байна
            </p>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>
            Хаах
          </Button>
          <Button
            onClick={add}
            disabled={pending || isFull || selected.size === 0}>
            Нэмэх ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PoolDialog({
  pool,
  busId,
  exchangeId,
  isFull,
  remaining,
  onDone,
}: {
  pool: PassengerAssignment[];
  busId: number;
  exchangeId: number;
  isFull: boolean;
  remaining: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((p) =>
      [
        p.displayName,
        p.organizationName,
        p.directionName,
        p.positionName,
        p.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [pool, query]);

  const groups = useMemo(() => {
    const m = new Map<
      string,
      { orgId: string; orgName: string; members: PassengerAssignment[] }
    >();
    for (const p of filtered) {
      const key = p.organizationId ?? "__none__";
      const g = m.get(key);
      if (g) g.members.push(p);
      else
        m.set(key, {
          orgId: key,
          orgName: p.organizationName ?? "Байгууллага тодорхойгүй",
          members: [p],
        });
    }
    return [...m.values()].sort((a, b) => a.orgName.localeCompare(b.orgName));
  }, [filtered]);

  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleGroup = (members: PassengerAssignment[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allSel = members.every((m) => next.has(m.id));
      members.forEach((m) => (allSel ? next.delete(m.id) : next.add(m.id)));
      return next;
    });

  const reset = () => {
    setSelected(new Set());
    setQuery("");
  };

  const add = () => {
    if (selected.size === 0) return;
    startTransition(async () => {
      const res = await bulkTransferPassengers(
        [...selected],
        busId,
        exchangeId,
        busId,
      );
      if (res.ok) {
        toast.success(
          `${res.transferred} зорчигч нэмэгдлээ` +
            (res.skippedCapacity > 0
              ? ` · ${res.skippedCapacity} багтсангүй`
              : ""),
        );
        setSelected(new Set());
        onDone();
        if (res.skippedCapacity === 0) setOpen(false);
      } else toast.error(res.error);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Inbox className="h-4 w-4" />
        Хуваарилаагүй жагсаалтаас нэмэх
        {pool.length > 0 && (
          <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">
            {pool.length}
          </span>
        )}
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Хуваарилаагүй зорчигчид</DialogTitle>
          <DialogDescription>
            Компаниар бүлэглэв. Сонгож энэ автобусанд нэмнэ. Сул суудал:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {remaining}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Нэр, компани, чиглэлээр шүүх..."
            className="pl-9"
          />
        </div>

        {pool.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Жагсаалт хоосон
          </p>
        ) : groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Хайлтад тохирох хүн алга
          </p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            <Accordion
              type="multiple"
              defaultValue={groups.map((g) => g.orgId)}
              className="space-y-2">
              {groups.map((g) => {
                const allSel = g.members.every((m) => selected.has(m.id));
                return (
                  <AccordionItem
                    key={g.orgId}
                    value={g.orgId}
                    className="rounded-lg border px-3">
                    <AccordionTrigger className="items-center py-3 hover:no-underline">
                      <div className="flex flex-1 items-center gap-2 text-left">
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{g.orgName}</span>
                        <Badge variant="secondary" className="tabular-nums">
                          {g.members.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-1.5 pb-3">
                      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={allSel}
                          onCheckedChange={() => toggleGroup(g.members)}
                        />
                        Бүгдийг сонгох
                      </label>
                      {g.members.map((m) => (
                        <label
                          key={m.id}
                          className="flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                          <Checkbox
                            className="mt-0.5"
                            checked={selected.has(m.id)}
                            onCheckedChange={() => toggleOne(m.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-foreground">
                              {m.displayName || "Нэргүй"}
                            </span>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              {m.directionName ? (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  {m.directionName}
                                </span>
                              ) : (
                                <span className="text-amber-600">
                                  чиглэлгүй
                                </span>
                              )}
                              {m.positionName && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="h-3 w-3 shrink-0" />
                                  {m.positionName}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}

        <DialogFooter className="items-center">
          {isFull && (
            <p className="mr-auto text-xs text-destructive">
              Автобус дүүрсэн байна
            </p>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>
            Хаах
          </Button>
          <Button
            onClick={add}
            disabled={pending || isFull || selected.size === 0}>
            Нэмэх ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
