import PolicyEditClient from "@/components/policy/PolicyEdit";
import PermissionCheck from "./permission-check";

interface PolicyEditPageProps {
  params: Promise<{ policy_id: string }>;
}

export default async function PolicyEditPage({ params }: PolicyEditPageProps) {
  const resolvedParams = await params;

  return (
    <PermissionCheck>
      <PolicyEditClient policyId={resolvedParams.policy_id} />
    </PermissionCheck>
  );
}
