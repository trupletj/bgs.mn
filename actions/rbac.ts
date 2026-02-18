import { createClient } from "@/utils/supabase/server";
import { cache } from "react";

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) throw new Error("Auth required");
  return user;
}

export const getUserRoles = cache(async (): Promise<string[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profile")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) return [];

  const { data } = await supabase
    .from("roles_profiles")
    .select(
      `
      roles ( name )
    `,
    )
    .eq("profile_id", profile.id);

  return data?.map((row: any) => row.roles.name) ?? [];
});

export async function hasRole(role: string | string[]): Promise<boolean> {
  const roles = await getUserRoles();
  return Array.isArray(role)
    ? role.some((r) => roles.includes(r))
    : roles.includes(role);
}

export async function hasPermission(
  module: string,
  action: string,
): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", {
    p_user_id: user.id,
    p_module: module,
    p_action: action,
  });

  if (error) {
    console.error("Permission check error:", error);
    return false;
  }

  return data === true;
}
