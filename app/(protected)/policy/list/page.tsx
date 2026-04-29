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
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <PolicyList is_delete={is_delete} />
      </div>
    </div>
  );
}
