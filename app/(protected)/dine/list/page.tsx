import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import DiningHallPage from "@/components/dine/dine-list";

export default async function DineListPage() {
  const is_create = await hasPermission("dining", "access");
  if (!is_create) {
    return <UnauthorizedPage />;
  }
  return (
    <div>
      <DiningHallPage />
    </div>
  );
}
