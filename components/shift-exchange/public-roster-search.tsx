"use client";

import { useMemo, useState } from "react";
import { Search, Bus, Clock, CheckCircle2, Users, UserCog } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DirectionBadge,
  DIRECTION_LABEL,
  formatBusDateTime,
  mnCompare,
} from "@/components/shift-exchange/shared";
import type { PublicRosterRow } from "@/actions/bus-roster-public";
import type { ShiftDirection } from "@/types/shift-exchange";

/** Аялалын ахлахыг эхэнд нь, дараа нь нэрээр эрэмбэлнэ. */
function sortRows(a: PublicRosterRow, b: PublicRosterRow): number {
  if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1;
  return mnCompare(a.passengerName, b.passengerName);
}

interface ExchangeGroup {
  exchangeId: number;
  exchangeName: string;
  exchangeDate: string;
  exchangeDirection: PublicRosterRow["exchangeDirection"];
  buses: Map<number, { busName: string; departureTime: string | null; rows: PublicRosterRow[] }>;
}

export function PublicRosterSearch({ rows }: { rows: PublicRosterRow[] }) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<ShiftDirection>("arriving");

  const counts = useMemo(() => {
    const c: Record<ShiftDirection, number> = { arriving: 0, departing: 0 };
    for (const r of rows) c[r.exchangeDirection]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.exchangeDirection !== direction) return false;
      if (!q) return true;
      return r.passengerName.toLowerCase().includes(q);
    });
  }, [rows, query, direction]);

  const exchanges = useMemo(() => {
    const byExchange = new Map<number, ExchangeGroup>();
    for (const r of filtered) {
      let g = byExchange.get(r.exchangeId);
      if (!g) {
        g = {
          exchangeId: r.exchangeId,
          exchangeName: r.exchangeName,
          exchangeDate: r.exchangeDate,
          exchangeDirection: r.exchangeDirection,
          buses: new Map(),
        };
        byExchange.set(r.exchangeId, g);
      }
      let b = g.buses.get(r.busId);
      if (!b) {
        b = { busName: r.busName, departureTime: r.departureTime, rows: [] };
        g.buses.set(r.busId, b);
      }
      b.rows.push(r);
    }
    return [...byExchange.values()].sort((a, b) =>
      b.exchangeDate.localeCompare(a.exchangeDate),
    );
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {(["arriving", "departing"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors " +
              (direction === d
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground")
            }>
            {DIRECTION_LABEL[d]}
            <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
              {counts[d]}
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Өөрийн нэрээр хайх..."
          className="pl-9"
          autoFocus
        />
      </div>

      {exchanges.length === 0 ? (
        <Card className="items-center gap-2 px-4 py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {query ? "Тохирох нэр олдсонгүй" : "Одоогоор мэдээлэл алга"}
          </p>
        </Card>
      ) : (
        exchanges.map((g) => (
          <Card key={g.exchangeId} className="gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">
                {g.exchangeName}
              </span>
              <DirectionBadge direction={g.exchangeDirection} />
              <span className="text-xs tabular-nums text-muted-foreground">
                {g.exchangeDate}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {[...g.buses.entries()]
                .sort(([, a], [, b]) => mnCompare(a.busName, b.busName))
                .map(([busId, b]) => (
                  <div key={busId} className="rounded-lg border">
                    <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
                      <Bus className="h-4 w-4 text-muted-foreground" />
                      {b.busName}
                      {b.departureTime && (
                        <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatBusDateTime(b.departureTime)}
                        </span>
                      )}
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        {b.rows.length} зорчигч
                      </span>
                    </div>
                    {/* Утсан дэлгэцэнд (<sm): хэвтээ scroll-гүй, багана нэг доор
                        нэг нь нягт stack хийсэн карт-мөр. */}
                    <div className="divide-y sm:hidden">
                      {b.rows
                        .sort(sortRows)
                        .map((r) => (
                          <div
                            key={r.passengerName + r.busId}
                            className="px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {r.isConfirmed && (
                                <CheckCircle2
                                  className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                                  aria-label="QR баталгаажсан"
                                />
                              )}
                              <span className="truncate text-sm font-medium text-foreground">
                                {r.lastName} {r.firstName || "Нэргүй"}
                              </span>
                              {r.isLeader && (
                                <Badge className="gap-1 border-transparent bg-amber-100 text-[11px] text-amber-800">
                                  <UserCog className="h-3 w-3" />
                                  Ахлах
                                </Badge>
                              )}
                            </div>
                            {(r.positionName || r.albaOrHeltes) && (
                              <p className="truncate text-xs text-muted-foreground">
                                {[r.positionName, r.albaOrHeltes]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                            {r.organizationName && (
                              <p className="truncate text-xs text-muted-foreground/70">
                                {r.organizationName}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>

                    {/* sm+ (tablet/desktop): бүрэн хүснэгт */}
                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-transparent hover:bg-transparent">
                            <TableHead>Байгууллага</TableHead>
                            <TableHead>Алба / Хэлтэс</TableHead>
                            <TableHead>Овог</TableHead>
                            <TableHead>Нэр</TableHead>
                            <TableHead>Албан тушаал</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {b.rows.sort(sortRows).map((r) => (
                            <TableRow
                              key={r.passengerName + r.busId}
                              className={
                                r.isLeader ? "bg-amber-50/60 hover:bg-amber-50/60" : undefined
                              }>
                              <TableCell className="text-sm text-muted-foreground">
                                {r.organizationName ?? "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {r.albaOrHeltes ?? "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {r.lastName || "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {r.isConfirmed && (
                                    <CheckCircle2
                                      className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                                      aria-label="QR баталгаажсан"
                                    />
                                  )}
                                  {r.firstName || "Нэргүй"}
                                  {r.isLeader && (
                                    <Badge className="gap-1 border-transparent bg-amber-100 text-[11px] text-amber-800">
                                      <UserCog className="h-3 w-3" />
                                      Ахлах
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {r.positionName ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
