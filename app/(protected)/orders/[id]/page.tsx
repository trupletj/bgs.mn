import { notFound } from "next/navigation";
import { getOrderWithDetail } from "@/actions/orders";
import { hasPermission } from "@/actions/rbac";
import { NewOrderDetailView } from "@/components/orders/order-detail-view";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { id } = await params;

  try {
    const [{ data: orderDetails, error }, canViewPrices] = await Promise.all([
      getOrderWithDetail(id),
      hasPermission("order", "view_price"),
    ]);

    if (error) {
      console.error("Error fetching order details:", error);
      notFound();
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
