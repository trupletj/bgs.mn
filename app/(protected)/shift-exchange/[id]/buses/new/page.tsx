import { notFound, redirect } from "next/navigation";
import { hasPermission } from "@/actions/rbac";
import { getDirections, getShiftExchange } from "@/actions/shift-exchange";
import { Card } from "@/components/ui/card";
import { BusForm } from "@/components/shift-exchange/bus-form";

export default async function NewBusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await hasPermission("shift_exchange", "view"))) redirect("/unauthorized");

  const exchange = await getShiftExchange(Number(id));
  if (!exchange) notFound();
  const directions = await getDirections();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 lg:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          {exchange.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Автобус нэмэх
        </h1>
      </div>
      <Card className="p-4 lg:p-6">
        <BusForm exchangeId={Number(id)} directions={directions} />
      </Card>
    </div>
  );
}
