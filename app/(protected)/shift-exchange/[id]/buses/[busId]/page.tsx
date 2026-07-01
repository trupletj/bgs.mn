import { notFound, redirect } from "next/navigation";
import { hasPermission } from "@/actions/rbac";
import {
  getAssignments,
  getBus,
  getBusesForExchange,
  getBusLeader,
  getDirections,
  getPoolAssignments,
  getShiftExchange,
} from "@/actions/shift-exchange";
import { AssignmentBoard } from "@/components/shift-exchange/assignment-board";
import { RealtimeRefresher } from "@/components/shift-exchange/realtime-refresher";

export default async function BusAssignmentPage({
  params,
}: {
  params: Promise<{ id: string; busId: string }>;
}) {
  const { id, busId } = await params;
  const exchangeId = Number(id);
  const busIdNum = Number(busId);

  const canView = await hasPermission("shift_exchange", "view");
  if (!canView) redirect("/unauthorized");

  const bus = await getBus(busIdNum);
  if (!bus || bus.shiftExchangeId !== exchangeId) notFound();

  const [assignments, poolAssignments, allBuses, directions, exchange, leader] =
    await Promise.all([
      getAssignments(busIdNum),
      getPoolAssignments(exchangeId),
      getBusesForExchange(exchangeId),
      getDirections(),
      getShiftExchange(exchangeId),
      getBusLeader(bus.tripLeaderId),
    ]);

  const otherBuses = allBuses.filter((b) => b.id !== busIdNum);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <RealtimeRefresher exchangeId={exchangeId} />
      <AssignmentBoard
        exchangeId={exchangeId}
        exchangeName={exchange?.name ?? null}
        exchangeDate={exchange?.exchangeDate ?? null}
        bus={bus}
        leader={leader}
        assignments={assignments}
        poolAssignments={poolAssignments}
        otherBuses={otherBuses}
        directions={directions}
        canAdmin={canView}
      />
    </div>
  );
}
