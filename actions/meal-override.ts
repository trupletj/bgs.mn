"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getProfileIdFromAuthUserId } from "./profile";
import { searchUsers as _searchUsers } from "./users";

type MealOverrideInput = {
  user_id: string;
  bteg_id?: string | null;
  date: string;
  meal_type: string;
  dining_hall_id: number;
  note?: string | null;
};

type MealOverrideUpdateInput = {
  meal_type: string;
  dining_hall_id: string;
  note?: string | null;
};

export async function createMealOverride(formData: MealOverrideInput) {
  const supabase = await createClient();
  const profile_id = await getProfileIdFromAuthUserId();

  const { error } = await supabase
    .from("meal_location_overrides")
    .insert([{ ...formData, created_by: profile_id }]);

  if (error) throw new Error(error.message);
  revalidatePath("/dine/temp-kitchen");
  return { success: true };
}

export async function createMealOverrides(overrides: MealOverrideInput[]) {
  if (overrides.length === 0) {
    throw new Error("Бүртгэх хуваарилалт олдсонгүй");
  }

  const supabase = await createClient();
  const profile_id = await getProfileIdFromAuthUserId();
  const uniqueOverrides = Array.from(
    new Map(
      overrides.map((override) => [
        `${override.user_id}|${override.date}|${override.meal_type}`,
        override,
      ]),
    ).values(),
  );
  const overrideKeys = new Set(
    uniqueOverrides.map(
      (override) =>
        `${override.user_id}|${override.date}|${override.meal_type}`,
    ),
  );
  const userIds = [
    ...new Set(uniqueOverrides.map((override) => override.user_id)),
  ];
  const dates = [...new Set(uniqueOverrides.map((override) => override.date))];
  const mealTypes = [
    ...new Set(uniqueOverrides.map((override) => override.meal_type)),
  ];

  const { data: existingOverrides, error: existingError } = await supabase
    .from("meal_location_overrides")
    .select("id, user_id, date, meal_type")
    .eq("is_deleted", false)
    .in("user_id", userIds)
    .in("date", dates)
    .in("meal_type", mealTypes);

  if (existingError) throw new Error(existingError.message);

  const existingIdsToDelete = (existingOverrides || [])
    .filter((override) =>
      overrideKeys.has(
        `${override.user_id}|${override.date}|${override.meal_type}`,
      ),
    )
    .map((override) => override.id);

  if (existingIdsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("meal_location_overrides")
      .update({ is_deleted: true })
      .in("id", existingIdsToDelete);

    if (deleteError) throw new Error(deleteError.message);
  }

  const { error } = await supabase.from("meal_location_overrides").insert(
    uniqueOverrides.map((override) => ({
      ...override,
      created_by: profile_id,
    })),
  );

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
// Centralized in actions/users.ts; map to shape this caller expects.
export async function searchUsers(query: string) {
  if (!query || query.length < 2) return [];
  const results = await _searchUsers(query, 15);
  return results.map((u) => ({
    id: u.id,
    bteg_id: u.bteg_id,
    first_name: u.first_name,
    last_name: u.last_name,
    nice_name: u.nice_name,
    position_name: u.position_name,
  }));
}

export async function updateMealOverride(
  id: number,
  values: MealOverrideUpdateInput,
) {
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
