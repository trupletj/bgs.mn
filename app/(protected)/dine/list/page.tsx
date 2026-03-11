import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import DiningHallPage from "@/components/dine/dine-list";

export default async function DineListPage() {
  const is_create = await hasPermission("dining", "access");
  if (!is_create) {
    return <UnauthorizedPage />;
  }
  const is_boss = await hasPermission("dining", "boss");
  return (
    <div>
      <DiningHallPage is_boss={is_boss} />
    </div>
  );
}
