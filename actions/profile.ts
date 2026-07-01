"use server";

import { cache } from "react";
import { createHash } from "crypto";
import { createClient } from "@/utils/supabase/server";

export async function getProfileInfo() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Хэрэглэгч олдсонгүй");
  }
  const { data: profile, error } = await supabase
    .from("profile")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (error) {
    throw new Error("Профайл олдсонгүй");
  }
  return profile;
}

const getProfileIdCached = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Хэрэглэгч олдсонгүй");
  }
  const { data, error } = await supabase
    .from("profile")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (error || !data) {
    throw new Error("Профайл олдсонгүй");
  }
  return data.id;
});

export async function getProfileIdFromAuthUserId() {
  return getProfileIdCached();
}

export const getQrPayload = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("bteg_id, idcard_number")
    .eq("auth_user_id", user.id)
    .single();

  if (!data?.bteg_id || !data?.idcard_number) return null;

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const key = createHash("md5")
    .update(`${dateStr}${data.idcard_number}bmisckey`)
    .digest("hex");

  return JSON.stringify({
    id_card_number: data.idcard_number,
    bteg_id: Number(data.bteg_id),
    key,
  });
});
