"use server";

import { createClient } from "@/utils/supabase/client";
import { ClauseJobPosition } from "@/types/types";

export async function getClauseJobPosition({
  clauseId,
  jobPositionId,
}: {
  clauseId: string;
  jobPositionId: string;
}): Promise<ClauseJobPosition | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clause_job_position")
    .select("*")
    .eq("clause_id", clauseId)
    .eq("job_position_id", jobPositionId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // No rows found
    console.error("Get clause job position error:", error);
    return null;
  }

  return data as ClauseJobPosition;
}

export async function createClauseJobPosition({
  clauseId,
  jobPositionId,
  is_checked,
  type,
}: {
  clauseId: string;
  jobPositionId: string;
  is_checked: boolean;
  type: string;
}): Promise<ClauseJobPosition> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clause_job_position")
    .insert([
      {
        clause_id: clauseId,
        job_position_id: jobPositionId,
        is_checked,
        type,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Create clause job position error:", error);
    throw error;
  }

  return data as ClauseJobPosition;
}

export async function updateClauseJobPosition({
  id,
  is_checked,
  type,
}: {
  id: string;
  is_checked?: boolean;
  type?: string;
}): Promise<ClauseJobPosition> {
  const supabase = createClient();

  const updateData: any = {};
  if (is_checked !== undefined) updateData.is_checked = is_checked;
  if (type !== undefined) updateData.type = type;

  const { data, error } = await supabase
    .from("clause_job_position")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Update clause job position error:", error);
    throw error;
  }

  return data as ClauseJobPosition;
}
