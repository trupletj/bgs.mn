"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Check, Briefcase, Phone, Loader2, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getMyOrgUsers } from "@/actions/shift-exchange";
import type { UserSearchResult } from "@/actions/users";

const OTHER = "Бусад";

function fullName(u: UserSearchResult): string {
  return `${u.last_name ?? ""} ${u.first_name ?? ""}`.trim() || "Нэргүй";
}

interface AlbaGroup {
  alba: string;
  users: UserSearchResult[];
  heltesBlocks: { heltes: string; users: UserSearchResult[] }[];
}

/**
 * Browse the rep's whole organization grouped by alba (department) → heltes.
 * Хүмүүсийг checkbox-оор сонгож, нэг товчоор бөөнөөр pool-руу нэмнэ.
 */
export function OrgBrowsePanel({
  excludeIds,
  disabled,
  onAdd,
  orgOverride,
}: {
  excludeIds: string[];
  disabled: boolean;
  onAdd: (ids: string[]) => void;
  /** super_admin only: browse a different company's employees. `undefined` =
   *  caller's own organization (default). `null` = no company chosen yet. */
  orgOverride?: string | null;
}) {
  const [users, setUsers] = useState<UserSearchResult[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (orgOverride === null) {
      setUsers(null);
      return;
    }
    let active = true;
    getMyOrgUsers(orgOverride).then((data) => {
      if (active) setUsers(data);
    });
    return () => {
      active = false;
    };
  }, [orgOverride]);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const clearSel = () => setSelected(new Set());

  const submit = () => {
    if (selected.size === 0) return;
    onAdd([...selected]);
    clearSel();
  };

  const groups = useMemo<AlbaGroup[]>(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? users.filter((u) =>
          [
            u.first_name,
            u.last_name,
            u.nice_name,
            u.position_name,
            u.heltes_name,
            u.department_name,
            u.phone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : users;

    // Алба (department_name) байхгүй ч хэлтэстэй (heltes_name) хүмүүсийг
    // "Бусад"-д цуглуулахгүй, харин өөрийн хэлтсээр нь тусдаа бүлэг болгоно.
    const byAlba = new Map<string, UserSearchResult[]>();
    for (const u of filtered) {
      const key =
        u.department_name?.trim() || u.heltes_name?.trim() || OTHER;
      const arr = byAlba.get(key);
      if (arr) arr.push(u);
      else byAlba.set(key, [u]);
    }

    return [...byAlba.entries()].map(([alba, list]) => {
      const byHeltes = new Map<string, UserSearchResult[]>();
      for (const u of list) {
        const hk = u.heltes_name?.trim() || OTHER;
        const arr = byHeltes.get(hk);
        if (arr) arr.push(u);
        else byHeltes.set(hk, [u]);
      }
      return {
        alba,
        users: list,
        heltesBlocks: [...byHeltes.entries()].map(([heltes, hUsers]) => ({
          heltes,
          users: hUsers,
        })),
      };
    });
  }, [users, query]);

  if (orgOverride === null) {
    return (
      <p className="rounded-md bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">
        Эхлээд дээрээс байгууллага сонгоно уу.
      </p>
    );
  }

  if (users === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Ачааллаж байна...
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <p className="rounded-md bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">
        {orgOverride === undefined
          ? "Таны байгууллагад идэвхтэй хэрэглэгч олдсонгүй."
          : "Энэ байгууллагад идэвхтэй хэрэглэгч олдсонгүй."}
      </p>
    );
  }

  return (
    <div className="relative flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Нэр, ажлын байр, хэлтсээр шүүх..."
          className="pl-9"
        />
      </div>

      {groups.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
          Хайлтад тохирох хүн алга.
        </p>
      ) : (
        <ScrollArea className="h-[28rem] pr-3">
          {/* доод хөвөгч bar-т зай үлдээж, агуулга нуугдахгүй */}
          <Accordion type="multiple" className="space-y-2 pb-16">
            {groups.map((g) => {
              const addable = g.users.filter((u) => !excluded.has(u.id));
              const addableIds = addable.map((u) => u.id);
              const addedCount = g.users.length - addable.length;
              const allSel =
                addable.length > 0 && addable.every((u) => selected.has(u.id));
              return (
                <AccordionItem
                  key={g.alba}
                  value={g.alba}
                  className="rounded-lg border px-3">
                  <AccordionTrigger className="items-center py-3 hover:no-underline">
                    <div className="flex flex-1 items-center gap-2 text-left">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{g.alba}</span>
                      <Badge variant="secondary" className="tabular-nums">
                        {g.users.length}
                      </Badge>
                      {addedCount > 0 && (
                        <span className="text-xs text-emerald-600">
                          {addedCount} нэмсэн
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-3">
                    {addable.length > 0 && (
                      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={allSel}
                          onCheckedChange={(v) => toggleMany(addableIds, !!v)}
                        />
                        Энэ албыг бүгдийг сонгох ({addableIds.length})
                      </label>
                    )}

                    {g.heltesBlocks.map((hb) => (
                      <div key={hb.heltes} className="space-y-1">
                        {(g.heltesBlocks.length > 1 || hb.heltes !== OTHER) &&
                        hb.heltes !== g.alba ? (
                          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                            {hb.heltes}
                          </p>
                        ) : null}
                        {hb.users.map((u) => {
                          const added = excluded.has(u.id);
                          if (added) {
                            return (
                              <div
                                key={u.id}
                                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 opacity-70">
                                <Person u={u} />
                                <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600">
                                  <Check className="h-3.5 w-3.5" />
                                  Нэмсэн
                                </span>
                              </div>
                            );
                          }
                          return (
                            <label
                              key={u.id}
                              className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2">
                              <Checkbox
                                checked={selected.has(u.id)}
                                onCheckedChange={() => toggleOne(u.id)}
                              />
                              <Person u={u} />
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>
      )}

      {/* хөвөгч bar — layout-ыг түлхэхгүй (absolute overlay) */}
      {selected.size > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/95 py-1.5 pl-3 pr-1.5 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
            <Button
              size="sm"
              className="h-8 rounded-full"
              disabled={disabled}
              onClick={submit}>
              <Plus className="h-4 w-4" />
              Нэмэх ({selected.size})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Person({ u }: { u: UserSearchResult }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-foreground">
        {fullName(u)}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {u.position_name && (
          <span className="flex items-center gap-1">
            <Briefcase className="h-3 w-3 shrink-0" />
            {u.position_name}
          </span>
        )}
        {u.phone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3 shrink-0" />
            {u.phone}
          </span>
        )}
      </div>
    </div>
  );
}
