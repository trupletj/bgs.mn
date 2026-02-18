import { getProfileIdFromAuthUserId } from "@/actions/profile";
import RateOrderForm from "@/components/orders/rate-order-form";
import { createClient } from "@/utils/supabase/client";
import { redirect } from "next/navigation";

interface RateOrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function RateOrderPage(props: RateOrderPageProps) {
  const params = await props.params;
  const { id } = params;
  const supabase = createClient();
  const profile = await getProfileIdFromAuthUserId();
  if (!profile) {
    redirect("/login");
  }
  const { data } = await supabase
    .from("order_instances")
    .select("id")
    .eq("order_id", id)
    .single();

  let order_instance_id: string | undefined;

  if (data) order_instance_id = data.id;

  if (!order_instance_id) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-500">
          Захиалгын instance ID олдсонгүй
        </div>
      </div>
    );
  }

  return (
    <RateOrderForm order_instance_id={order_instance_id} profile_id={profile} />
  );
}
