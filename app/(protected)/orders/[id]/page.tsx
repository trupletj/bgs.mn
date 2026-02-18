import { notFound } from "next/navigation";
import { getOrderWithDetail } from "@/actions/orders";
import { NewOrderDetailView } from "@/components/orders/order-detail-view";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { id } = await params;

  try {
    const { data: orderDetails, error } = await getOrderWithDetail(id);

    if (error) {
      console.error("Error fetching order details:", error);
      notFound();
    }

    if (!orderDetails) {
      console.error("No order details found for ID:", id);
      notFound();
    }

    return <NewOrderDetailView orderDetails={orderDetails} />;
  } catch (error) {
    console.error("Unexpected error fetching order:", error);
    notFound();
  }
}
