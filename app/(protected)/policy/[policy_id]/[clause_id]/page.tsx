import { hasRole } from "@/actions/rbac";
import ClauseJobConnect from "@/components/policy/ClauseJobConnect";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{
    policy_id: string;
    clause_id: string;
  }>;
}

export default async function ConnectPage({ params }: Props) {
  const is_access = await hasRole(["monitoring_emp", "super_admin"]);
  if (!is_access) {
    redirect("/unauthorized");
  }
  const { policy_id, clause_id } = await params;

  return <ClauseJobConnect policy_id={policy_id} clause_id={clause_id} />;
}
