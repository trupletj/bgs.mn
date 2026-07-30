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
  // HR профайл хараахан үүсээгүй шинэ ажилтан (зөвхөн утасны OTP-оор
  // нэвтэрсэн) энд мөр байхгүй байж болно — throw хийвэл SiteHeader
  // бүх protected хуудсан дээр л уналт үзүүлнэ, тул null буцаана.
  const { data: profile } = await supabase
    .from("profile")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

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
  if (!user?.phone) return null;

  // public.users.auth_user_id хэвшмэл бөглөгддөггүй (~19% хэрэглэгчид л
  // байдаг — create-auth-user edge function-ийн бөглөх код comment
  // хийгдсэн хэвээр), тиймээс auth_user_id-аар БИШ, profile-ийн адилаар
  // auth.users.phone-оор шууд холбоно (public.users.phone нь
  // create_profile_from_auth_user()-тэй ижил эх сурвалж).
  const { data } = await supabase
    .from("users")
    .select("bteg_id, idcard_number")
    .eq("phone", user.phone)
    .maybeSingle();

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
