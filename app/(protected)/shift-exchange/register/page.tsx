import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bus } from "lucide-react";
import { hasPermission } from "@/actions/rbac";
import { getShiftExchanges } from "@/actions/shift-exchange";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DirectionBadge,
  isFridayDate,
} from "@/components/shift-exchange/shared";

export default async function RegisterListPage() {
  const [canSubmit, canView] = await Promise.all([
    hasPermission("shift_exchange", "submit"),
    hasPermission("shift_exchange", "view"),
  ]);
  if (!canSubmit && !canView) redirect("/unauthorized");

  const exchanges = (await getShiftExchanges()).filter(
    (e) => e.status === "published" && e.openForRegistration,
  );

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Ээлж солилцоо
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Зорчигч бүртгэх
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Ээлж сонгоод өөрийн байгууллагын зорчигчдоо бүртгэнэ үү. Хүсэлт нь HR-т
          очиж автобусанд хуваарилагдана.
        </p>
      </div>

      {exchanges.length === 0 ? (
        <Card className="items-center gap-2 px-4 py-12 text-center">
          <Bus className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">Идэвхтэй ээлж алга</p>
          <p className="text-sm text-muted-foreground">
            Зорчигч бүртгэхээр нээгдсэн ээлж одоогоор байхгүй байна
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exchanges.map((e) => {
            const friday = isFridayDate(e.exchangeDate);
            return (
              <Link
                key={e.id}
                href={`/shift-exchange/register/${e.id}`}
                className="group">
                <Card
                  className={
                    "gap-2 p-4 transition-colors hover:border-primary/40 " +
                    (friday ? "bg-amber-50" : "")
                  }>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {e.name}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {e.exchangeDate}
                    </span>
                    <DirectionBadge direction={e.direction} />
                    {friday && (
                      <Badge className="border-transparent bg-amber-200 text-amber-900">
                        Баасан
                      </Badge>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
