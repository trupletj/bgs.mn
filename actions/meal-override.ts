"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getProfileIdFromAuthUserId } from "./profile";

export async function createMealOverride(formData: any) {
  const supabase = await createClient();
  const profile_id = await getProfileIdFromAuthUserId();

  const { data, error } = await supabase
    .from("meal_location_overrides")
    .insert([{ ...formData, created_by: profile_id }]);

  if (error) throw new Error(error.message);
  revalidatePath("/dine/temp-kitchen");
  return { success: true };
}

export async function deleteOverride(id: number) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("meal_location_overrides")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/dine/temp-kitchen");
}
export async function searchUsers(query: string) {
  const supabase = await createClient();

  if (!query || query.length < 2) return [];

  const { data, error } = await supabase
    .from("users")
    .select("id, bteg_id, first_name, last_name, nice_name, position_name")
    .or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,position_name.ilike.%${query}%`,
    )
    .eq("is_active", true)
    .limit(15);

  if (error) {
    console.error("Search error:", error);
    return [];
  }

  return data;
}

export async function updateMealOverride(id: number, values: any) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_location_overrides")
    .update({
      meal_type: values.meal_type,
      dining_hall_id: parseInt(values.dining_hall_id),
      note: values.note,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/dine/temp-kitchen");
}
