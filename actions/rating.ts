import { createClient } from "@/utils/supabase/client";
import { Rating } from "@/types/types";

export async function getRatings(clause_job_position_id: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("rating")
    .select("*")
    .eq("clause_job_position_id", clause_job_position_id)
    .order("scored_date", { ascending: false });

  if (error) {
    console.error("Get ratings error:", error);
    throw error;
  }

  return data as Rating[];
}

export async function createRating(ratingData: {
  score: number;
  description: string | null;
  clause_job_position_id: string;
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("rating")
    .insert([
      {
        ...ratingData,
        scored_date: new Date().toISOString(),
        is_deleted: false,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Create rating error:", error);
    throw error;
  }

  return data as Rating;
}
