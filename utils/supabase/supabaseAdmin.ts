import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server only

  if (!url) throw new Error("Supabase URL (NEXT_PUBLIC_SUPABASE_URL) is required.");
  if (!serviceRoleKey) throw new Error("Supabase Service Role Key (SUPABASE_SERVICE_ROLE_KEY) is required.");

  _admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}