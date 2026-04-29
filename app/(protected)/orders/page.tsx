import Link from "next/link";
import { Plus } from "lucide-react";
import { hasRole } from "@/actions/rbac";
import { Button } from "@/components/ui/button";
import AllOrderList from "@/components/orders/all-order-list";

export default async function OrdersPage() {
  const canCreate = await hasRole(["hr_emp", "super_admin", "order_system"]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Захиалгын модуль
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Захиалга</h1>
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

      <AllOrderList />
    </div>
  );
}
