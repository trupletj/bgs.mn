"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getUser } from "@/actions/rbac";

export interface BannerRow {
  id: number;
  title: string;
  subtitle: string | null;
  tag: string | null;
  imageUrl: string;
  linkUrl: string | null;
  newsId: number | null;
  sortOrder: number;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface BannerInput {
  title: string;
  subtitle?: string | null;
  tag?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
  newsId?: number | null;
  sortOrder: number;
  publish: boolean;
}

type ActionResult = { ok: true } | { ok: false; error: string };

function mapRow(row: Record<string, unknown>): BannerRow {
  return {
    id: Number(row.id),
    title: String(row.title ?? ""),
    subtitle: (row.subtitle as string) ?? null,
    tag: (row.tag as string) ?? null,
    imageUrl: String(row.image_url ?? ""),
    linkUrl: (row.link_url as string) ?? null,
    newsId: row.news_id != null ? Number(row.news_id) : null,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
    publishedAt: (row.published_at as string) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function getBannersList(): Promise<BannerRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("banners")
    .select(
      "id, title, subtitle, tag, image_url, link_url, news_id, sort_order, is_active, published_at, created_at",
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[banners] getBannersList failed:", error.message);
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

function rowFromInput(input: BannerInput, profileId?: number | null) {
  return {
    title: input.title,
    subtitle: input.subtitle || null,
    tag: input.tag || null,
    image_url: input.imageUrl,
    link_url: input.linkUrl || null,
    news_id: input.newsId ?? null,
    sort_order: input.sortOrder ?? 0,
    published_at: input.publish ? new Date().toISOString() : null,
    ...(profileId !== undefined ? { created_by: profileId } : {}),
  };
}

export async function createBanner(input: BannerInput): Promise<ActionResult> {
  const supabase = await createClient();
  const profileId = await currentProfileId();

  const { error } = await supabase
    .from("banners")
    .insert({ ...rowFromInput(input, profileId), is_active: true });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/banners");
  return { ok: true };
}

export async function updateBanner(
  id: number,
  input: BannerInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("banners")
    .update(rowFromInput(input))
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/banners");
  return { ok: true };
}

export async function togglePublish(
  id: number,
  publish: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("banners")
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/banners");
  return { ok: true };
}

export async function deleteBanner(id: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("banners").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/banners");
  return { ok: true };
}
