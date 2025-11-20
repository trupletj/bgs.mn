import { hasPermission } from "@/actions/rbac";
import PolicyList from "@/components/policy/PolicyList";

export default async function Page() {
  const is_create = await hasPermission("policy", "create");
  const is_delete = await hasPermission("policy", "delete");
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <PolicyList is_create={is_create} is_delete={is_delete} />
      </div>
    </div>
  );
}
