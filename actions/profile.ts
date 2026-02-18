"use server";

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

export async function getProfileIdFromAuthUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Хэрэглэгч олдсонгүй");
  }
  return supabase
    .from("profile")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()
    .then(({ data, error }) => {
      if (error) {
        throw new Error("Профайл олдсонгүй");
      }
      return data?.id;
    });
}
