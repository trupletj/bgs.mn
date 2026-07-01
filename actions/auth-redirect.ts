"use server";

import { getUserRoles } from "@/actions/rbac";

export async function getRedirectPath(): Promise<string> {
  const roles = await getUserRoles();
  return roles.length === 0 ? "/attendance-view" : "/dashboard";
}
