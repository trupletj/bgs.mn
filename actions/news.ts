"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getUser } from "@/actions/rbac";

export interface NewsRow {
  id: number;
  title: string;
  description: string;
  body: string | null;
  imageUrl: string | null;
  likes: number;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface NewsInput {
  title: string;
  description: string;
  body?: string | null;
  imageUrl?: string | null;
  publish: boolean;
}

type ActionResult = { ok: true } | { ok: false; error: string };

function mapRow(row: Record<string, unknown>): NewsRow {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    body: (row.body as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    likes: Number(row.likes ?? 0),
    isActive: Boolean(row.is_active),
    publishedAt: (row.published_at as string) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function getNewsList(): Promise<NewsRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news")
    .select(
      "id, title, description, body, image_url, likes, is_active, published_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[news] getNewsList failed:", error.message);
    return [];
  }
  return ((data as Record<string, unknown>[]) ?? []).map(mapRow);
}

async function currentProfileId(): Promise<number | null> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  return data ? Number(data.id) : null;
}

export async function createNews(input: NewsInput): Promise<ActionResult> {
  const supabase = await createClient();
  const profileId = await currentProfileId();

  const { error } = await supabase.from("news").insert({
    title: input.title,
    description: input.description,
    body: input.body || null,
    image_url: input.imageUrl || null,
    is_active: true,
    published_at: input.publish ? new Date().toISOString() : null,
    created_by: profileId,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/news");
  return { ok: true };
}

export async function updateNews(
  id: number,
  input: NewsInput,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("news")
    .update({
      title: input.title,
      description: input.description,
      body: input.body || null,
      image_url: input.imageUrl || null,
      published_at: input.publish ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/news");
  return { ok: true };
}

export async function togglePublish(
  id: number,
  publish: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("news")
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/news");
  return { ok: true };
}

export async function deleteNews(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("news").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/news");
  return { ok: true };
}
