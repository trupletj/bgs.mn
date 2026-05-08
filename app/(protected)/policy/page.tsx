import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import PolicyList from "@/components/policy/PolicyList";

export default async function Page() {
  const [is_delete, is_access] = await Promise.all([
    hasPermission("policy", "delete"),
    hasPermission("policy", "access"),
  ]);
  if (!is_access) {
    return <UnauthorizedPage />;
  }
  return <PolicyList is_delete={is_delete} />;
}
