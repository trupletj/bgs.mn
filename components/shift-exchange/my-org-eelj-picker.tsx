"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, Check } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { linkMyOrgEeljGroups } from "@/actions/shift-exchange";
import type { EeljGroupOption } from "@/types/shift-exchange";

/**
 * Гэрээт компаний төлөөлөгч зөвхөн ӨӨРСДИЙН байгууллагад харьяалагдах ээлжийн
 * бүлгээ сонгоод, тэдгээрийн гишүүдийг шууд хуваарилаагүй (pool) жагсаалтад
 * нэмнэ — shift-exchange/[id]-ийн "Ээлжийн бүлэг холбох" (LinkedGroups)-тэй
 * ижил зарчим, гэхдээ байгууллагаар хязгаарлагдсан.
 */
export function MyOrgEeljPicker({
  exchangeId,
  groups,
  linkedGroupIds,
}: {
  exchangeId: number;
  groups: EeljGroupOption[];
  linkedGroupIds: Set<string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    if (selected.size === 0) return;
    startTransition(async () => {
      const res = await linkMyOrgEeljGroups(exchangeId, [...selected]);
      if (res.ok) {
        toast.success(`${res.added} хүн хуваарилаагүй жагсаалтад нэмэгдлээ`);
        setSelected(new Set());
        router.refresh();
      } else toast.error(res.error);
    });
  };

  if (groups.length === 0) {
    return (
      <p className="rounded-md bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">
        Танай байгууллагад бүртгэлтэй ээлжийн бүлэг алга.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {groups.map((g) => {
          const linked = linkedGroupIds.has(g.btegId);
          if (linked) {
            return (
              <li
                key={g.btegId}
                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 opacity-70">
                <span className="flex items-center gap-2 text-sm">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  {g.name}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                  Холбогдсон
                </span>
              </li>
            );
          }
          return (
            <li key={g.btegId}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm">
                <Checkbox
                  checked={selected.has(g.btegId)}
                  onCheckedChange={() => toggleOne(g.btegId)}
                />
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                {g.name}
              </label>
            </li>
          );
        })}
      </ul>

      {selected.size > 0 && (
        <div className="sticky bottom-0 z-20 flex justify-center py-2">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-primary/40 bg-background px-4 py-3 shadow-xl">
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
            <Button size="sm" className="h-8" disabled={pending} onClick={submit}>
              Бүртгэх ({selected.size})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
