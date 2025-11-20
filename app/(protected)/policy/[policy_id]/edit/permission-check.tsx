import { hasPermission, hasRole } from "@/actions/rbac";
import { redirect } from "next/navigation";

interface PermissionCheckProps {
  children: React.ReactNode;
}

export default async function PermissionCheck({
  children,
}: PermissionCheckProps) {
  const is_admin = await hasRole("super_admin");
  if (!is_admin) {
    const canEditPolicy = await hasPermission("policy", "edit");
    if (!canEditPolicy) {
      redirect("/unauthorized");
    }
  }

  return <>{children}</>;
}
