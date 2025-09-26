// app/orders/[id]/review/page.tsx
import { createClient } from "@/utils/supabase/client";
import { getProfileIdFromAuthUserId } from "@/actions/review";
import ReviewedOrderDetail from "@/components/reviewed-order";
import OrderReviewerDetail from "@/components/order-review-detail";

interface ReviewOrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewOrderPage({
  params,
}: ReviewOrderPageProps) {
  try {
    const { id } = await params;
    const profile_id = await getProfileIdFromAuthUserId();

    const supabase = createClient();

    // Order reviewers-г шалгах
    const { data: order_reviewer, error } = await supabase
      .from("order_reviewers")
      .select("*")
      .eq("order_id", id)
      .eq("profile_id", profile_id)
      .single();

    if (error) {
      console.error("Order reviewer error:", error);
      return (
        <div className="container mx-auto py-6">
          <div className="text-center text-red-500">
            Та энэ захиалгыг шалгах эрхгүй байна эсвэл захиалга олдсонгүй
          </div>
        </div>
      );
    }

    if (!order_reviewer) {
      return (
        <div className="container mx-auto py-6">
          <div className="text-center text-red-500">
            Захиалгын шалгуулагчийн мэдээлэл олдсонгүй
          </div>
        </div>
      );
    }

    if (order_reviewer.is_reviewed) {
      return <ReviewedOrderDetail orderId={id} profile_id={profile_id} />;
    }

    return <OrderReviewerDetail orderId={id} profile_id={profile_id} />;
  } catch (error) {
    console.error("Page error:", error);
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-500">
          Алдаа гарлаа. Дахин оролдоно уу.
        </div>
      </div>
    );
  }
}
