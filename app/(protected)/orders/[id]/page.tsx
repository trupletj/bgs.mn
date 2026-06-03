import { notFound } from "next/navigation";
import {
  getCanAccessOrderProcess,
  getPurchaseAllowedProcessIdsForCurrentUser,
} from "@/actions/order-process";
import { getOrderWithDetail } from "@/actions/orders";
import { hasPermission } from "@/actions/rbac";
import { NewOrderDetailView } from "@/components/orders/order-detail-view";
import UnauthorizedPage from "@/app/unauthorized/page";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { id } = await params;

  try {
    const [{ data: orderDetails, error }, canViewPrices, orderAccess] =
      await Promise.all([
        getOrderWithDetail(id),
        hasPermission("order", "view_price"),
        getCanAccessOrderProcess(id),
      ]);

    if (error) {
      console.error("Error fetching order details:", error);
      notFound();
    }

    if (!orderAccess) {
      return <UnauthorizedPage />;
    }

    if (!orderDetails) {
      console.error("No order details found for ID:", id);
      notFound();
    }

    return (
      <NewOrderDetailView
        orderDetails={orderDetails}
        canViewPrices={canViewPrices}
      />
    );
  } catch (error) {
    console.error("Unexpected error fetching order:", error);
    notFound();
  }
}
