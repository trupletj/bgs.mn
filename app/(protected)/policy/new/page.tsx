import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import NewPolicy from "@/components/policy/NewPolicy";

const page = async () => {
  const is_create = await hasPermission("policy", "create");
  if (!is_create) {
    return <UnauthorizedPage />;
  }
  return <NewPolicy />;
};

export default page;
