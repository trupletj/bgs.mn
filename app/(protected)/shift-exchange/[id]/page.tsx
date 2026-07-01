import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Plus,
  Users,
  ArrowRight,
  Clock,
  UserCog,
  Inbox,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { hasPermission } from "@/actions/rbac";
import {
  getBusesForExchange,
  getEeljGroups,
  getLinkedGroups,
  getPoolAssignments,
  getReportRows,
  getShiftExchange,
} from "@/actions/shift-exchange";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DirectionBadge,
  StatusBadge,
  NoLeaderBadge,
  passengerCapacity,
} from "@/components/shift-exchange/shared";
import { ExchangeDetailActions } from "@/components/shift-exchange/exchange-detail-actions";
import { LinkedGroups } from "@/components/shift-exchange/linked-groups";
import { PooledByCompany } from "@/components/shift-exchange/pooled-by-company";
import { SmartAssignButton } from "@/components/shift-exchange/smart-assign-button";
import { BusCardActions } from "@/components/shift-exchange/bus-card-actions";
import { RegistrationDeadlineControl } from "@/components/shift-exchange/registration-deadline-control";
import { PassengerLookup } from "@/components/shift-exchange/passenger-lookup";
import { RealtimeRefresher } from "@/components/shift-exchange/realtime-refresher";

export default async function ShiftExchangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);

  const canView = await hasPermission("shift_exchange", "view");
  if (!canView) redirect("/unauthorized");

  const exchange = await getShiftExchange(id);
  if (!exchange) notFound();

  const [buses, pool, linkedGroups, allGroups, rosterRows] = await Promise.all([
    getBusesForExchange(id),
    getPoolAssignments(id),
    getLinkedGroups(id),
    getEeljGroups(),
    getReportRows(id),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {canView && <RealtimeRefresher exchangeId={id} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/shift-exchange"
            className="text-xs text-muted-foreground hover:underline">
            ← Ээлжүүд
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {exchange.name}
            </h1>
            <StatusBadge status={exchange.status} />
            <DirectionBadge direction={exchange.direction} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {exchange.exchangeDate}
            {exchange.notes ? ` · ${exchange.notes}` : ""}
          </p>
        </div>
        {canView && (
          <div className="flex items-center gap-2">
            {buses.length > 0 && (
              <Button asChild variant="outline">
                <a href={`/shift-exchange/${id}/export`}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel татах
                </a>
              </Button>
            )}
            {canView && (
              <>
                <Button asChild>
                  <Link href={`/shift-exchange/${id}/buses/new`}>
                    <Plus className="h-4 w-4" />
                    Автобус нэмэх
                  </Link>
                </Button>
                <ExchangeDetailActions id={id} />
              </>
            )}
          </div>
        )}
      </div>

      {canView && exchange.openForRegistration && (
        <RegistrationDeadlineControl
          exchangeId={id}
          exchangeDate={exchange.exchangeDate}
          registrationOverrideUntil={exchange.registrationOverrideUntil}
        />
      )}

      {canView && (
        <LinkedGroups
          exchangeId={id}
          linkedGroups={linkedGroups}
          allGroups={allGroups}
        />
      )}

      {canView && buses.length > 0 && buses.some((b) => !b.tripLeaderId) && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">
              {buses.filter((b) => !b.tripLeaderId).length} автобус
            </span>{" "}
            аялалын ахлахгүй байна. Автобус бүрт заавал нэг аялалын ахлах оноох
            шаардлагатай.
          </span>
        </div>
      )}

      {canView &&
        (buses.length === 0 ? (
          <Card className="items-center gap-2 px-4 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground/50" />
            <p className="font-semibold text-foreground">Автобус алга</p>
            <p className="text-sm text-muted-foreground">
              Энэ ээлжид автобус нэмж зорчигч хуваарилаарай
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {buses.map((bus) => {
              const seatLimit = passengerCapacity(bus.capacity);
              const pct = seatLimit
                ? Math.round((bus.passengerCount / seatLimit) * 100)
                : 0;
              return (
                <div key={bus.id} className="relative">
                  {canView && (
                    <div className="absolute right-2 top-2 z-10">
                      <BusCardActions
                        exchangeId={id}
                        busId={bus.id}
                        busName={bus.name}
                        passengerCount={bus.passengerCount}
                      />
                    </div>
                  )}
                  <Link
                    href={`/shift-exchange/${id}/buses/${bus.id}`}
                    className="group block">
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
                      {!canView && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {bus.departureTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(bus.departureTime).toLocaleString("mn-MN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
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
                          {bus.passengerCount} / {seatLimit} зорчигч +1 ахлах
                        </span>
                        <span className="text-sky-600">
                          QR {bus.confirmedCount}
                        </span>
                      </div>
                      <Progress value={pct} />
                    </div>
                  </Card>
                  </Link>
                </div>
              );
            })}
          </div>
        ))}

      {canView && (
        <PassengerLookup
          rows={rosterRows}
          buses={buses}
          exchangeId={id}
          canAdmin={canView}
        />
      )}

      {canView && pool.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Хуваарилаагүй зорчигчид</h2>
            <span className="text-xs text-muted-foreground">
              ({pool.length}) — байгууллагууд оруулсан, автобус хүлээж буй
            </span>
            <div className="h-px flex-1 bg-border" />
            {canView && (
              <SmartAssignButton exchangeId={id} pooledCount={pool.length} />
            )}
          </div>
          <PooledByCompany
            pool={pool}
            buses={buses}
            exchangeId={id}
            canAdmin={canView}
          />
          <p className="text-xs text-muted-foreground">
            “Ухаалаг хуваарилах” нь зорчигчдыг чиглэлээр нь автобусанд
            автоматаар хуваарилна. Чиглэлгүй хүмүүсийг автобус дотроос гараар
            нэмнэ.
          </p>
        </section>
      )}
    </div>
  );
}
