import { Bus, CalendarDays, MapPin, Phone, Users } from "lucide-react";
import {
  getMyEeljCards,
  getMyLedRoster,
  getPendingRequestsForLeader,
} from "@/actions/eelj";
import { EeljCard } from "@/components/eelj/eelj-card";
import { PendingRequestsSection } from "@/components/eelj/pending-requests-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { RosterAutobus, RosterEntry } from "@/types/eelj";

function formatDayDate(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DirectionBadge({ isCome }: { isCome: boolean }) {
  return isCome ? (
    <Badge className="border-transparent bg-emerald-100 text-emerald-700">
      Ирэх
    </Badge>
  ) : (
    <Badge className="border-transparent bg-indigo-100 text-indigo-700">
      Буух
    </Badge>
  );
}

function PassengerRow({ p }: { p: RosterEntry }) {
  const fullName =
    [p.passengerLastName, p.passengerFirstName].filter(Boolean).join(" ") ||
    `bteg_id ${p.passengerBtegId}`;
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {p.sitNumber != null && p.sitNumber > 0 ? (
          <Badge variant="outline" className="tabular-nums">
            №{p.sitNumber}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            —
          </Badge>
        )}
        <span className="font-medium text-foreground">{fullName}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {p.landPositionAddress && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {p.landPositionAddress}
          </span>
        )}
        {p.passengerPhone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {p.passengerPhone}
          </span>
        )}
      </div>
    </div>
  );
}

function RosterAutobusBlock({ bus }: { bus: RosterAutobus }) {
  return (
    <Card className="gap-0 p-0">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bus className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">
            {bus.autobusNumber}
          </span>
          <Badge variant="outline" className="text-xs">
            {bus.directionName ?? "Чиглэлгүй"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDayDate(bus.dayDate)}
          </span>
          <DirectionBadge isCome={bus.isCome} />
        </div>
      </div>
      {bus.passengers.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Зорчигчгүй
        </p>
      ) : (
        <div className="divide-y divide-border/60">
          {bus.passengers.map((p, i) => (
            <PassengerRow
              key={`${bus.autobusId}-${p.passengerBtegId ?? i}`}
              p={p}
            />
          ))}
        </div>
      )}
      <div className="flex items-center justify-end border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        Нийт {bus.passengers.length} зорчигч
      </div>
    </Card>
  );
}

export default async function EeljPage() {
  const [cards, roster, pendingForLeader] = await Promise.all([
    getMyEeljCards(),
    getMyLedRoster(),
    getPendingRequestsForLeader(),
  ]);

  const isLeader = roster.length > 0 || pendingForLeader.length > 0;

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Тээврийн хуваарь
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Ээлж солилцоо
        </h1>
      </div>

      {isLeader && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Шинэ хүсэлтүүд
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <PendingRequestsSection requests={pendingForLeader} />
        </section>
      )}

      {isLeader && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Хариуцсан машинуудын зорчигчид
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col gap-3">
            {roster.map((bus) => (
              <RosterAutobusBlock
                key={`${bus.autobusId}-${bus.eeljId}`}
                bus={bus}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Хуваарь</h2>
          <div className="h-px flex-1 bg-border" />
        </div>
        {cards.length === 0 ? (
          <Card className="items-center gap-2 px-4 py-10 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
            <p className="font-semibold text-foreground">
              Хуваарь хараахан гараагүй байна
            </p>
            <p className="text-sm text-muted-foreground">
              Танд ойрын ээлжид хуваарь гарсны дараа энд харагдана
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {cards.map((card) => (
              <EeljCard
                key={`${card.eeljId}-${card.autobusId}`}
                card={card}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
