"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// КИОСК УДИРДАХ
export async function addKiosk(
  hallId: number,
  data: { device_name: string; device_uuid: string },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("kiosks").insert([
    {
      dining_hall_id: hallId,
      ...data,
    },
  ]);
  if (error) throw error;
  revalidatePath("/dine");
}

// ТОГООЧ УДИРДАХ
export async function addChef(
  hallId: number,
  data: { name: string; pin: string },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("chefs").insert([
    {
      dining_hall_id: hallId,
      ...data,
    },
  ]);
  if (error) throw error;
  revalidatePath("/dine");
}

export async function updateMealSlot(hallId: number, slots: any[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_time_slots")
    .upsert(slots.map((s) => ({ dining_hall_id: hallId, ...s })));
  if (error) throw error;
  revalidatePath("/dine");
}
