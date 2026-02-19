// @/utils/supabase/supabaseAdmin.ts
"use server"; // <--- Энэ л хамгийн чухал нь

import { getSupabaseAdmin } from "@/utils/supabase/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export async function forceUserLogout(userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Энэ сервер дээр undefined биш байна

  const supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabaseAdmin.auth.admin.signOut(userId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function forceUserLogout1(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  console.log("Attempting Force Logout via Ban for ID:", userId);

  // Хэрэглэгчийг маш богино хугацаанд блоклох
  // Энэ үйлдэл нь бүх идэвхтэй сессийг нь шууд устгадаг
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { ban_duration: "1s" }, // ердөө 1 секунд бан хийнэ
  );

  if (error) {
    console.error("Ban Error:", error);
    return { success: false, error: error.message };
  }

  console.log("Ban applied successfully, sessions revoked.");
  return { success: true };
}
