import { redirect } from "next/navigation";
import JobDescriptionList from "@/components/job-description/job-description-list";
import { hasPermission, hasRole } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";

export default async function Page() {
  const isManagerOrAdmin = await hasRole(["super_admin", "hr_emp"]);

  if (!isManagerOrAdmin) {
    redirect("/unauthorized");
  }

  const is_access = await hasPermission("job_description", "access");
  if (!is_access) {
    return <UnauthorizedPage />;
  }
  const is_create = await hasPermission("job_description", "create");

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <JobDescriptionList is_create={is_create} />
      </div>
    </div>
  );
}
