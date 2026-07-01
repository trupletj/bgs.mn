import { redirect } from "next/navigation";
import { hasPermission } from "@/actions/rbac";
import { getShiftExchanges } from "@/actions/shift-exchange";
import { ExchangeListClient } from "@/components/shift-exchange/exchange-list-client";

export default async function ShiftExchangeListPage() {
  const canView = await hasPermission("shift_exchange", "view");
  if (!canView) redirect("/unauthorized");

  const exchanges = await getShiftExchanges();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Ээлж солилцоо
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Ээлж солилцооны жагсаалт
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Ээлжийн мэдээлэл цаг бүртгэлийн системээс автоматаар татагдана. Баасан
          гарагийн ээлжийг тодоор тэмдэглэв.
        </p>
      </div>

      <ExchangeListClient exchanges={exchanges} canAdmin={canView} />
    </div>
  );
}
