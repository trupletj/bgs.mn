"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus, Users, X, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { linkAndAssignGroup, unlinkGroup } from "@/actions/shift-exchange";
import { BusyIndicator } from "@/components/ui/page-loader";
import type { EeljGroupOption, LinkedGroup } from "@/types/shift-exchange";

export function LinkedGroups({
  exchangeId,
  linkedGroups,
  allGroups,
}: {
  exchangeId: number;
  linkedGroups: LinkedGroup[];
  allGroups: EeljGroupOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const linkedIds = useMemo(
    () => new Set(linkedGroups.map((g) => g.btegId)),
    [linkedGroups],
  );
  const available = useMemo(
    () => allGroups.filter((g) => !linkedIds.has(g.btegId)),
    [allGroups, linkedIds],
  );

  const onLink = (groupBtegId: string) =>
    startTransition(async () => {
      setOpen(false);
      const res = await linkAndAssignGroup(exchangeId, groupBtegId);
      if (res.ok) {
        toast.success(`${res.added} хүн хуваарилаагүй жагсаалтад нэмэгдлээ`);
        router.refresh();
      } else toast.error(res.error ?? "Алдаа гарлаа");
    });

  const onUnlink = (groupBtegId: string) =>
    startTransition(async () => {
      const res = await unlinkGroup(exchangeId, groupBtegId);
      if (res.ok) {
        toast.success(
          `Холбоо салгаж ${res.removed} хүн хаслаа` +
            (res.keptConfirmed > 0
              ? ` · ${res.keptConfirmed} баталгаажсан үлдсэн`
              : ""),
        );
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <section className="space-y-3">
      <BusyIndicator busy={pending} />
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        <h2 className="text-sm font-semibold">Холбосон ээлжийн бүлгүүд</h2>
        <span className="text-xs text-muted-foreground">
          ({linkedGroups.length}) — холбоход ажилчид хуваарилаагүй жагсаалтад
          нэмэгдэнэ
        </span>
        <div className="h-px flex-1 bg-border" />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" disabled={pending || available.length === 0}>
              <Plus className="h-4 w-4" />
              Ээлжийн бүлэг холбох
              <ChevronsUpDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <Command>
              <CommandInput placeholder="Бүлэг хайх..." />
              <CommandList>
                <CommandEmpty>Бүлэг олдсонгүй</CommandEmpty>
                <CommandGroup>
                  {available.map((g) => (
                    <CommandItem
                      key={g.btegId}
                      value={g.name}
                      onSelect={() => onLink(g.btegId)}>
                      {g.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {linkedGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ээлжийн бүлэг холбоогүй байна. Холбосон бүлгийн ажилчид хуваарилаагүй
          жагсаалтад нэмэгдэнэ — дараа нь «Ухаалаг хуваарилах»-аар автобусанд
          хуваарилна.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {linkedGroups.map((g) => (
            <Badge
              key={g.btegId}
              className="gap-1 border-emerald-300 bg-emerald-100 py-1 pl-2.5 pr-1 text-sm font-normal text-emerald-800">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>{g.name.trim()}</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    title="Холбоо салгах"
                    disabled={pending}
                    className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      «{g.name.trim()}» ээлжийн хүмүүсийг хасах уу?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Энэ бүлгийн ажилчид автобусанд хуваарилагдсан болон
                      хуваарилагдаагүй бүх ажилчид хасагдана. Зөвхөн QR
                      уншуулсан хүмүүс хэвээр үлдэнэ.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Болих</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onUnlink(g.btegId)}
                      className="bg-destructive text-white hover:bg-destructive/90">
                      Хасах
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}
