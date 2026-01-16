import AllOrderList from "@/components/orders/all-order-list";
import { StatusHistory } from "@/components/orders/status-history";

export default async function OrderManagePage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <AllOrderList />
      </div>
    </div>
  );
}
