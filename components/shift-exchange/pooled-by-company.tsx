"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Building2,
  Briefcase,
  MapPin,
  AlertTriangle,
  Bus,
  Users,
  Trash2,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  bulkTransferPassengers,
  removePoolSubmissions,
} from "@/actions/shift-exchange";
import { BusyIndicator } from "@/components/ui/page-loader";
import { passengerCapacity } from "@/components/shift-exchange/shared";
import type {
  BusWithStats,
  PassengerAssignment,
} from "@/types/shift-exchange";

const NO_ORG = "__none__";
const NO_EELJ = "Ээлжийн бүлэггүй";

interface EeljBlock {
  eeljKey: string;
  eeljName: string;
  members: PassengerAssignment[];
}

interface CompanyGroup {
  orgId: string;
  orgName: string;
  members: PassengerAssignment[];
  eeljBlocks: EeljBlock[];
}

/**
 * Хуваарилаагүй зорчигчдыг компаниар бүлэглэж харуулна. HR (canAdmin) бол хүн
 * сонгоод дээр үүссэн автобусанд шууд хуваарилж болно.
 */
export function PooledByCompany({
  pool,
  buses = [],
  exchangeId,
  canAdmin = false,
}: {
  pool: PassengerAssignment[];
  buses?: BusWithStats[];
  exchangeId: number;
  canAdmin?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState("");

  const selectable = canAdmin && buses.length > 0;

  const groups = useMemo<CompanyGroup[]>(() => {
    const byOrg = new Map<string, CompanyGroup>();
    for (const p of pool) {
      const orgId = p.organizationId ?? NO_ORG;
      const existing = byOrg.get(orgId);
      if (existing) existing.members.push(p);
      else
        byOrg.set(orgId, {
          orgId,
          orgName: p.organizationName ?? "Байгууллага тодорхойгүй",
          members: [p],
          eeljBlocks: [],
        });
    }
    return [...byOrg.values()]
      .map((g) => {
        const byEelj = new Map<string, EeljBlock>();
        for (const p of g.members) {
          const eeljKey = p.eeljGroupId ?? NO_EELJ;
          const existing = byEelj.get(eeljKey);
          if (existing) existing.members.push(p);
          else
            byEelj.set(eeljKey, {
              eeljKey,
              eeljName: p.eeljGroupName ?? NO_EELJ,
              members: [p],
            });
        }
        g.eeljBlocks = [...byEelj.values()].sort((a, b) =>
          a.eeljName.localeCompare(b.eeljName, "mn", { numeric: true }),
        );
        return g;
      })
      .sort((a, b) => a.orgName.localeCompare(b.orgName));
  }, [pool]);

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

  const assign = () => {
    if (!target || selected.size === 0) return;
    const busName = buses.find((b) => String(b.id) === target)?.name ?? "";
    startTransition(async () => {
      const res = await bulkTransferPassengers(
        [...selected],
        Number(target),
        exchangeId,
        Number(target),
      );
      if (res.ok) {
        toast.success(
          `${res.transferred} зорчигч ${busName}-д хуваарилагдлаа` +
            (res.skippedCapacity > 0
              ? ` · ${res.skippedCapacity} багтсангүй`
              : ""),
        );
        setSelected(new Set());
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const remove = () =>
    startTransition(async () => {
      const res = await removePoolSubmissions([...selected], exchangeId);
      if (res.ok) {
        toast.success(`${res.count} зорчигч устгагдлаа`);
        setSelected(new Set());
        router.refresh();
      } else toast.error(res.error);
    });

  if (pool.length === 0) return null;

  // Цөөн компанитай бол бүгдийг нь нээлттэй харуулна.
  const defaultOpen =
    groups.length <= 3 ? groups.map((g) => g.orgId) : undefined;

  return (
    <div className="space-y-2">
      <BusyIndicator busy={pending} />
      {selectable && selected.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-row flex-wrap items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Badge variant="secondary" className="tabular-nums">
            {selected.size} сонгосон
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground"
            onClick={() => setSelected(new Set())}>
            Цуцлах
          </Button>
          <div className="flex-1" />
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger size="sm" className="h-8 w-48">
              <SelectValue placeholder="Автобус сонгох..." />
            </SelectTrigger>
            <SelectContent>
              {buses.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name} ({b.passengerCount}/{passengerCapacity(b.capacity)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8"
            disabled={pending || !target}
            onClick={assign}>
            <Bus className="h-4 w-4" />
            Хуваарилах
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-destructive hover:bg-destructive/5 hover:text-destructive"
                disabled={pending}>
                <Trash2 className="h-4 w-4" />
                Устгах
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Сонгосон {selected.size} зорчигчийг устгах уу?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Эдгээр хүн ээлжээс бүрэн хасагдана. Дахин бүртгэх боломжтой.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Болих</AlertDialogCancel>
                <AlertDialogAction
                  onClick={remove}
                  className="bg-destructive text-white hover:bg-destructive/90">
                  Устгах
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <Accordion
        type="multiple"
        defaultValue={defaultOpen}
        className="flex flex-col gap-2">
        {groups.map((g) => {
          const allSel =
            selectable && g.members.every((m) => selected.has(m.id));
          return (
            <AccordionItem
              key={g.orgId}
              value={g.orgId}
              className="rounded-lg border px-3">
              <AccordionTrigger className="items-center py-3 hover:no-underline">
                <div className="flex flex-1 items-center gap-2.5 text-left">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{g.orgName}</span>
                  <Badge variant="secondary" className="tabular-nums">
                    {g.members.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-1.5 pb-3">
                {selectable && (
                  <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={allSel}
                      onCheckedChange={() => toggleGroup(g.members)}
                    />
                    Бүгдийг сонгох
                  </label>
                )}
                <div className="flex flex-col gap-3">
                  {g.eeljBlocks.map((eb) => (
                    <div key={eb.eeljKey} className="space-y-1.5">
                      {g.eeljBlocks.length > 1 && (
                        <p className="flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                          <CalendarClock className="h-3 w-3 shrink-0" />
                          {eb.eeljName}
                          <span className="tabular-nums normal-case text-muted-foreground/50">
                            ({eb.members.length})
                          </span>
                        </p>
                      )}
                      <ul className="flex flex-col gap-1.5">
                        {eb.members.map((m) => {
                          const noDirection = !m.directionName;
                          const Row = (
                            <>
                              <span className="font-medium text-foreground">
                                {m.displayName || "Нэргүй"}
                              </span>
                              {noDirection ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  чиглэлгүй
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  {m.directionName}
                                </span>
                              )}
                              {m.positionName && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Briefcase className="h-3 w-3 shrink-0" />
                                  {m.positionName}
                                </span>
                              )}
                              {m.companionGroupName && (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 text-[11px]">
                                  <Users className="h-3 w-3" />
                                  {m.companionGroupName}
                                </Badge>
                              )}
                            </>
                          );
                          return selectable ? (
                            <li key={m.id}>
                              <label className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border px-2.5 py-1.5 text-sm">
                                <Checkbox
                                  checked={selected.has(m.id)}
                                  onCheckedChange={() => toggleOne(m.id)}
                                />
                                {Row}
                              </label>
                            </li>
                          ) : (
                            <li
                              key={m.id}
                              className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border px-2.5 py-1.5 text-sm">
                              {Row}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
