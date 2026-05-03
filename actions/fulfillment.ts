// actions/fulfillment.ts
"use server";

import { createClient } from "@/utils/supabase/client";
import { revalidatePath } from "next/cache";
import { getProfileIdFromAuthUserId } from "./profile";
import { assertCanAccessOrderItemPurchase } from "./order-process";

export async function createFulfillment(formData: {
  orderItemId: number;
  quantity: number;
  notes?: string;
  path: string;
  status: string;
}) {
  const supabase = createClient();
  await assertCanAccessOrderItemPurchase(formData.orderItemId);

  const profileId = await getProfileIdFromAuthUserId();

  const { data: fulfillment, error: fError } = await supabase
    .from("order_fulfillment")
    .insert({
      order_item_id: formData.orderItemId,
      quantity: formData.quantity,
      notes: formData.notes,
      status: formData.status,
    })
    .select()
    .single();

  if (fError) throw new Error(fError.message);

  // 3. Түүхэнд бичих (Initial History)
  const { error: hError } = await supabase
    .from("fulfillment_status_history")
    .insert({
      fulfillment_id: fulfillment.id,
      old_status: null,
      new_status: formData.status,
      reason: "Анхны захиалга үүсгэв",
      changed_by: profileId,
    });

  if (hError) throw new Error(hError.message);

  revalidatePath(formData.path);
  return { success: true };
}
