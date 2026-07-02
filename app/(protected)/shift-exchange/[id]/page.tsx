import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Inbox, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { hasPermission } from "@/actions/rbac";
import {
  getBusesForExchange,
  getDirections,
  getEeljGroups,
  getLinkedGroups,
  getPoolAssignments,
  getReportRows,
  getShiftExchange,
} from "@/actions/shift-exchange";
import { Button } from "@/components/ui/button";
import { DirectionBadge, StatusBadge } from "@/components/shift-exchange/shared";
import { LinkedGroups } from "@/components/shift-exchange/linked-groups";
import { PooledByCompany } from "@/components/shift-exchange/pooled-by-company";
import { SmartAssignButton } from "@/components/shift-exchange/smart-assign-button";
import { BusGrid } from "@/components/shift-exchange/bus-grid";
import { AddBusButton } from "@/components/shift-exchange/add-bus-button";
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

  const [buses, pool, linkedGroups, allGroups, rosterRows, directions] =
    await Promise.all([
      getBusesForExchange(id),
      getPoolAssignments(id),
      getLinkedGroups(id),
      getEeljGroups(),
      getReportRows(id),
      getDirections(),
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
              <AddBusButton
                exchangeId={id}
                exchangeDirection={exchange.direction}
                exchangeDate={exchange.exchangeDate}
                directions={directions}
              />
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

      {canView && (
        <BusGrid
          exchangeId={id}
          exchangeName={exchange.name}
          exchangeDate={exchange.exchangeDate}
          buses={buses}
          pool={pool}
          directions={directions}
          canAdmin={canView}
        />
      )}

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
