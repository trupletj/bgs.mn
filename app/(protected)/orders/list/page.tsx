import { getOrdersByUser } from "@/actions/orders";
import { OrdersList } from "@/components/orders/OrdersList";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { hasRole } from "@/actions/rbac";

export default async function OrdersListPage() {
  const [orders, canCreate] = await Promise.all([
    getOrdersByUser(),
    hasRole(["hr_emp", "super_admin", "order_system"]),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Захиалгын модуль
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Миний захиалгууд
          </h1>
        </div>
        {canCreate && (
          <Button asChild className="h-9 gap-2 self-start sm:self-auto">
            <Link href="/orders/add">
              <Plus className="h-4 w-4" />
              Шинэ захиалга
            </Link>
          </Button>
        )}
      </div>

      <OrdersList orders={orders.data ?? []} />
    </div>
  );
}
