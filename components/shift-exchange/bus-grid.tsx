"use client";

import { useEffect, useState } from "react";
import { Users, Clock, UserCog, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DirectionBadge,
  NoLeaderBadge,
  formatBusDateTime,
} from "@/components/shift-exchange/shared";
import { BusCardActions } from "@/components/shift-exchange/bus-card-actions";
import { AssignmentBoard } from "@/components/shift-exchange/assignment-board";
import {
  getAssignments,
  getBusLeader,
  type BusLeaderRow,
} from "@/actions/shift-exchange";
import type {
  AutobusDirection,
  BusWithStats,
  PassengerAssignment,
} from "@/types/shift-exchange";

/**
 * Автобус бүрийг картаар харуулж, дарахад тусдаа URL руу шилжихийн оронд
 * шууд том dialog нээж AssignmentBoard-ыг дотор нь рендерлэнэ (олон удаа
 * URL хооронд буцаж/шилжих төвөгийг арилгах зорилготой). assignments/leader-ийг
 * зөвхөн dialog нээгдэх үед lazy fetch хийнэ — bus/pool/directions нь эцэг
 * Server Component-оос аль хэдийн ирсэн props тул дахин татахгүй.
 */
export function BusGrid({
  exchangeId,
  exchangeName,
  exchangeDate,
  buses,
  pool,
  directions,
  canAdmin,
}: {
  exchangeId: number;
  exchangeName: string;
  exchangeDate: string;
  buses: BusWithStats[];
  pool: PassengerAssignment[];
  directions: AutobusDirection[];
  canAdmin: boolean;
}) {
  const [openBusId, setOpenBusId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<PassengerAssignment[]>([]);
  const [leader, setLeader] = useState<BusLeaderRow | null>(null);
  const [loading, setLoading] = useState(false);

  const openBus = buses.find((b) => b.id === openBusId) ?? null;

  const loadExtras = (busId: number, tripLeaderId: string | null) => {
    setLoading(true);
    Promise.all([getAssignments(busId), getBusLeader(tripLeaderId)]).then(
      ([a, l]) => {
        setAssignments(a);
        setLeader(l);
        setLoading(false);
      },
    );
  };

  useEffect(() => {
    if (openBus) loadExtras(openBus.id, openBus.tripLeaderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBusId]);

  if (buses.length === 0) {
    return (
      <Card className="items-center gap-2 px-4 py-12 text-center">
        <Users className="h-8 w-8 text-muted-foreground/50" />
        <p className="font-semibold text-foreground">Автобус алга</p>
        <p className="text-sm text-muted-foreground">
          Энэ ээлжид автобус нэмж зорчигч хуваарилаарай
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {buses.map((bus) => {
          const occupied = bus.passengerCount + (bus.tripLeaderId ? 1 : 0);
          const pct = bus.capacity
            ? Math.round((occupied / bus.capacity) * 100)
            : 0;
          return (
            <div key={bus.id} className="relative">
              {canAdmin && (
                <div className="absolute right-2 top-2 z-10">
                  <BusCardActions
                    exchangeId={exchangeId}
                    busId={bus.id}
                    busName={bus.name}
                    passengerCount={bus.passengerCount}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => setOpenBusId(bus.id)}
                className="group block w-full text-left">
                <Card className="gap-3 p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 pr-8">
                        <span className="font-semibold text-foreground">
                          {bus.name}
                        </span>
                        <DirectionBadge direction={bus.direction} />
                        {!bus.tripLeaderId && <NoLeaderBadge />}
                      </div>
                      {bus.directions.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {bus.directions.map((d) => d.name).join(" → ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {bus.departureTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatBusDateTime(bus.departureTime)}
                      </span>
                    )}
                    {bus.tripLeaderName ? (
                      <span className="flex items-center gap-1">
                        <UserCog className="h-3.5 w-3.5" />
                        {bus.tripLeaderName}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-600">
                        <UserCog className="h-3.5 w-3.5" />
                        Ахлах оноогоогүй
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                      <span className="text-muted-foreground">
                        {occupied} / {bus.capacity} зорчигч
                      </span>
                      <span className="text-sky-600">
                        QR {bus.confirmedCount}
                      </span>
                    </div>
                    <Progress value={pct} />
                  </div>
                </Card>
              </button>
            </div>
          );
        })}
      </div>

      <Dialog
        open={openBusId != null}
        onOpenChange={(o) => !o && setOpenBusId(null)}>
        <DialogContent
          showCloseButton
          className="h-[80vh] w-[80vw] !max-w-none overflow-y-auto">
          <DialogTitle className="sr-only">
            {openBus?.name ?? "Автобус"}
          </DialogTitle>
          {loading && assignments.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            openBus && (
              <AssignmentBoard
                exchangeId={exchangeId}
                exchangeName={exchangeName}
                exchangeDate={exchangeDate}
                bus={openBus}
                leader={leader}
                assignments={assignments}
                poolAssignments={pool}
                otherBuses={buses.filter((b) => b.id !== openBus.id)}
                directions={directions}
                canAdmin={canAdmin}
                onDataChange={() => loadExtras(openBus.id, openBus.tripLeaderId)}
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
