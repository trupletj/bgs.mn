import { hasPermission } from "@/actions/rbac";
import AllOrderList from "@/components/orders/all-order-list";

export default async function OrdersPage() {
  const [canAccessAllOrders, canCreateOrder] = await Promise.all([
    hasPermission("order", "access"),
    hasPermission("order", "create"),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <AllOrderList
        canAccessAllOrders={canAccessAllOrders}
        canCreateOrder={canCreateOrder}
      />
    </div>
  );
}
