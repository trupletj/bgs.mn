"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  Bus,
  CheckCircle2,
  Inbox,
  X,
  MoreVertical,
  ArrowLeftRight,
  CornerUpLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  bulkTransferPassengers,
  bulkUnassignToPool,
  transferPassenger,
  unassignToPool,
  type ReportRow,
} from "@/actions/shift-exchange";
import { passengerCapacity } from "@/components/shift-exchange/shared";
import { BusyIndicator } from "@/components/ui/page-loader";
import type { BusWithStats } from "@/types/shift-exchange";

const UNASSIGNED = "(хуваарилаагүй)";
const ALL = "__all__";

interface Filters {
  lastName: string;
  firstName: string;
  phone: string;
  position: string;
  direction: string;
  org: string;
  alba: string;
}

const EMPTY: Filters = {
  lastName: "",
  firstName: "",
  phone: "",
  position: "",
  direction: "",
  org: "",
  alba: "",
};

const TEXT_FIELDS: {
  key: keyof Filters;
  label: string;
  placeholder: string;
}[] = [
  { key: "lastName", label: "Овог", placeholder: "овгоор..." },
  { key: "firstName", label: "Нэр", placeholder: "нэрээр..." },
  { key: "phone", label: "Утас", placeholder: "утсаар..." },
];

const AFTER_ALBA_TEXT_FIELDS: typeof TEXT_FIELDS = [
  { key: "position", label: "Албан тушаал", placeholder: "тушаалаар..." },
];

const ALBA_OPTIONS_ID = "alba-heltes-options";

function match(value: string | null, q: string): boolean {
  if (!q.trim()) return true;
  return (value ?? "").toLowerCase().includes(q.trim().toLowerCase());
}

/**
 * "Хэн ямар автобусанд" — ээлжийн зорчигчдыг олон талбараар (овог, нэр, утас,
 * албан тушаал, чиглэл, байгууллага, алба/хэлтэс) шүүж, аль автобусанд
 * хуваарилагдсаныг харна.
 */
export function PassengerLookup({
  rows,
  buses = [],
  exchangeId,
  canAdmin = false,
}: {
  rows: ReportRow[];
  buses?: BusWithStats[];
  exchangeId: number;
  canAdmin?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState<Filters>(EMPTY);
  const set = (key: keyof Filters, v: string) =>
    setF((prev) => ({ ...prev, [key]: v }));

  const showActions = canAdmin && buses.length > 0;

  const onTransfer = (row: ReportRow, targetBusId: number, busName: string) =>
    startTransition(async () => {
      const res = await transferPassenger(
        row.assignmentId,
        targetBusId,
        exchangeId,
        row.busId ?? targetBusId,
      );
      if (res.ok) {
        toast.success(`${row.passengerName} → ${busName}`);
        router.refresh();
      } else toast.error(res.error);
    });

  const onUnassign = (row: ReportRow) => {
    if (row.busId == null) return;
    const fromBusId = row.busId;
    startTransition(async () => {
      const res = await unassignToPool(row.assignmentId, exchangeId, fromBusId);
      if (res.ok) {
        toast.success(`${row.passengerName} хуваарилаагүй руу буцлаа`);
        router.refresh();
      } else toast.error(res.error);
    });
  };

  // ── multi-select bulk ───────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkTarget, setBulkTarget] = useState("");
  const clearSel = () => setSelected(new Set());
  const toggleRow = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onBulkUnassign = () =>
    startTransition(async () => {
      const res = await bulkUnassignToPool([...selected], exchangeId, 0);
      if (res.ok) {
        toast.success(`${res.count} зорчигч хуваарилаагүй руу буцлаа`);
        clearSel();
        router.refresh();
      } else toast.error(res.error);
    });

  const onBulkTransfer = () => {
    if (!bulkTarget) return;
    const busName = buses.find((b) => String(b.id) === bulkTarget)?.name ?? "";
    startTransition(async () => {
      const res = await bulkTransferPassengers(
        [...selected],
        Number(bulkTarget),
        exchangeId,
        0,
      );
      if (res.ok) {
        toast.success(
          `${res.transferred} зорчигч ${busName}-д шилжлээ` +
            (res.skippedCapacity > 0
              ? ` · ${res.skippedCapacity} багтсангүй`
              : ""),
        );
        clearSel();
        setBulkTarget("");
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const directions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.directionName) s.add(r.directionName);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const orgs = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.organizationName) s.add(r.organizationName);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const albaOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.alba) s.add(r.alba);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Оролтын талбарууд шууд (lag-гүй) шинэчлэгдэнэ; 100+ мөрийг дахин
  // шүүж, sort хийж, DropdownMenu-тэй мөр бүрийг дахин render хийх (хүнд
  // ажиллагаа) нь deferred утга дээр суурилж бага зэрэг хойшлогдоно ингэснээр
  // бичих үед input hang хийхгүй.
  const deferredF = useDeferredValue(f);
  const active = Object.values(deferredF).some((v) => v.trim() !== "");

  const filtered = useMemo(() => {
    if (!active) return [];
    const base = rows.filter(
      (r) =>
        match(r.lastName, deferredF.lastName) &&
        match(r.firstName, deferredF.firstName) &&
        match(r.phone, deferredF.phone) &&
        match(r.alba, deferredF.alba) &&
        match(r.position, deferredF.position) &&
        (deferredF.direction === "" || r.directionName === deferredF.direction) &&
        (deferredF.org === "" || r.organizationName === deferredF.org),
    );
    return [...base].sort(
      (a, b) =>
        a.busName.localeCompare(b.busName) ||
        a.passengerName.localeCompare(b.passengerName),
    );
  }, [rows, deferredF, active]);

  const allSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.assignmentId));
  const toggleAll = () =>
    setSelected(
      allSelected ? new Set() : new Set(filtered.map((r) => r.assignmentId)),
    );

  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <BusyIndicator busy={pending} />
      <div className="flex items-center gap-2">
        <Bus className="h-4 w-4" />
        <h2 className="text-sm font-semibold">Хэн ямар автобусанд</h2>
        <span className="text-xs text-muted-foreground">({rows.length})</span>
        <div className="h-px flex-1 bg-border" />
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground"
            onClick={() => setF(EMPTY)}>
            <X className="h-3.5 w-3.5" />
            Цэвэрлэх
          </Button>
        )}
      </div>

      <Card className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-7">
        {TEXT_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {field.label}
            </Label>
            <Input
              value={f[field.key]}
              onChange={(e) => set(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="h-9"
            />
          </div>
        ))}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Алба/Хэлтэс</Label>
          <Input
            value={f.alba}
            onChange={(e) => set("alba", e.target.value)}
            placeholder="сонгох эсвэл бичих..."
            list={ALBA_OPTIONS_ID}
            className="h-9"
          />
          <datalist id={ALBA_OPTIONS_ID}>
            {albaOptions.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
        {AFTER_ALBA_TEXT_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {field.label}
            </Label>
            <Input
              value={f[field.key]}
              onChange={(e) => set(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="h-9"
            />
          </div>
        ))}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Чиглэл</Label>
          <Select
            value={f.direction === "" ? ALL : f.direction}
            onValueChange={(v) => set("direction", v === ALL ? "" : v)}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Бүгд" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Бүгд</SelectItem>
              {directions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Байгууллага</Label>
          <Select
            value={f.org === "" ? ALL : f.org}
            onValueChange={(v) => set("org", v === ALL ? "" : v)}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Бүгд" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Бүгд</SelectItem>
              {orgs.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {!active ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Дээрх талбаруудын аль нэгийг бөглөж хайвал тухайн хүн аль автобусанд
          хуваарилагдсаныг харуулна.
        </p>
      ) : (
        <>
          {showActions && selected.size > 0 && (
            <div className="sticky top-2 z-20 flex flex-row flex-wrap items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <Badge variant="secondary" className="tabular-nums">
                {selected.size} сонгосон
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground"
                onClick={clearSel}>
                Цуцлах
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={pending}
                onClick={onBulkUnassign}>
                <CornerUpLeft className="h-4 w-4" />
                Хуваарилаагүй руу буцаах
              </Button>
              <Select value={bulkTarget} onValueChange={setBulkTarget}>
                <SelectTrigger size="sm" className="h-8 w-44">
                  <SelectValue placeholder="Автобус сонгох..." />
                </SelectTrigger>
                <SelectContent>
                  {buses.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name} ({b.passengerCount}/{passengerCapacity(b.capacity)}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8"
                disabled={pending || !bulkTarget}
                onClick={onBulkTransfer}>
                <ArrowLeftRight className="h-4 w-4" />
                Шилжүүлэх
              </Button>
            </div>
          )}
          <Card className="max-h-96 overflow-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {showActions && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Бүгдийг сонгох"
                      />
                    </TableHead>
                  )}
                  <TableHead>Нэр</TableHead>
                  <TableHead className="w-44">Автобус</TableHead>
                  <TableHead className="w-40">Байгууллага</TableHead>
                  <TableHead className="w-40">Алба/Хэлтэс</TableHead>
                  <TableHead className="w-28">Чиглэл</TableHead>
                  {showActions && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showActions ? 7 : 5}
                      className="py-10 text-center text-sm text-muted-foreground">
                      Олдсонгүй
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r, i) => {
                    const unassigned = r.busName === UNASSIGNED;
                    return (
                      <TableRow
                        key={`${r.passengerName}-${i}`}
                        data-state={
                          selected.has(r.assignmentId) ? "selected" : undefined
                        }>
                        {showActions && (
                          <TableCell>
                            <Checkbox
                              checked={selected.has(r.assignmentId)}
                              onCheckedChange={() => toggleRow(r.assignmentId)}
                              aria-label={`${r.passengerName} сонгох`}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">
                            {r.passengerName || "Нэргүй"}
                          </span>
                          {r.confirmed && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {[r.position, r.phone].filter(Boolean).join(" · ")}
                        </span>
                      </TableCell>
                      <TableCell>
                        {unassigned ? (
                          <Badge className="gap-1 border-transparent bg-amber-100 text-amber-800">
                            <Inbox className="h-3 w-3" />
                            Хуваарилаагүй
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Bus className="h-3 w-3" />
                            {r.busName}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.organizationName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.alba ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.directionName ?? "—"}
                      </TableCell>
                      {showActions && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={pending}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {r.busId != null && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => onUnassign(r)}>
                                    <CornerUpLeft className="h-4 w-4" />
                                    Хуваарилаагүй руу буцаах
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                Автобусанд шилжүүлэх
                              </DropdownMenuLabel>
                              {buses
                                .filter((b) => b.id !== r.busId)
                                .map((b) => (
                                  <DropdownMenuItem
                                    key={b.id}
                                    onClick={() =>
                                      onTransfer(r, b.id, b.name)
                                    }>
                                    <ArrowLeftRight className="h-4 w-4" />
                                    {b.name}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
        </>
      )}
    </section>
  );
}
