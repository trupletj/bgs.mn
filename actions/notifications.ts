"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type NotificationType = "info" | "warning" | "success";

export interface SentNotificationRow {
  id: number;
  profileId: number;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

export interface SendNotificationInput {
  mode: "broadcast" | "targeted";
  /** targeted үед: сонгосон ажилтнуудын `users.id` (uuid) жагсаалт */
  userIds?: string[];
  title: string;
  message: string;
  type: NotificationType;
}

type SendResult = { ok: true; count: number } | { ok: false; error: string };

export async function getSentNotifications(
  limit = 100,
): Promise<SentNotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, profile_id, title, message, type, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[notifications] getSentNotifications failed:", error.message);
    return [];
  }

  return ((data as Record<string, unknown>[]) ?? []).map((row) => ({
    id: Number(row.id),
    profileId: Number(row.profile_id),
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    type: (row.type as NotificationType) ?? "info",
    isRead: Boolean(row.is_read),
    createdAt: String(row.created_at),
  }));
}

/** users.id (uuid) жагсаалтыг profile.id руу `auth_user_id`-аар хөрвүүлнэ. */
async function resolveProfileIds(userIds: string[]): Promise<number[]> {
  if (userIds.length === 0) return [];
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("users")
    .select("auth_user_id")
    .in("id", userIds);

  const authIds = ((users as { auth_user_id: string | null }[]) ?? [])
    .map((u) => u.auth_user_id)
    .filter((v): v is string => Boolean(v));

  if (authIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profile")
    .select("id")
    .in("auth_user_id", authIds);

  return ((profiles as { id: number }[]) ?? []).map((p) => Number(p.id));
}

export async function sendNotification(
  input: SendNotificationInput,
): Promise<SendResult> {
  const supabase = await createClient();

  if (input.mode === "broadcast") {
    const { data, error } = await supabase.rpc("broadcast_notification", {
      p_title: input.title,
      p_message: input.message,
      p_type: input.type,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/notifications");
    return { ok: true, count: Number(data ?? 0) };
  }

  const profileIds = await resolveProfileIds(input.userIds ?? []);
  if (profileIds.length === 0) {
    return { ok: false, error: "Хүлээн авах ажилтан олдсонгүй" };
  }

  const rows = profileIds.map((profileId) => ({
    profile_id: profileId,
    title: input.title,
    message: input.message,
    type: input.type,
  }));

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/notifications");
  return { ok: true, count: rows.length };
}
