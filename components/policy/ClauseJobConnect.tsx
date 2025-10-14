import { getOrganizations } from "@/actions/organization";
import OrganizationNode from "./OrganizationNode";
import { getPolicyById } from "@/actions/policy";
import { getClauseById } from "@/actions/clause";

interface ClauseJobConnectProps {
  policy_id: string;
  clause_id: string;
}

const ClauseJobConnect = async ({
  policy_id,
  clause_id,
}: ClauseJobConnectProps) => {
  const [organizations, policy, clause] = await Promise.all([
    getOrganizations(),
    getPolicyById(policy_id),
    getClauseById(clause_id),
  ]);

  return (
    <div className="space-y-6">
      <div className="m-4 p-4 rounded-lg shadow-md">
        <div className="text-2xl font-semibold text-blue-800 mb-4">
          {policy?.name || "Журам"}
        </div>
        <div className="flex flex-wrap gap-4 text-base">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <span className="font-medium text-gray-700">Журмын дугаар:</span>
            <span className="font-medium">
              {policy?.reference_code || "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <span className="font-medium text-gray-700">Заалтын дугаар:</span>
            <span>{clause?.reference_number || "N/A"}</span>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <span>{clause?.text || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Organization жагсаалт */}
      <div className="space-y-4">
        {organizations &&
          organizations.map((org) => (
            <OrganizationNode key={org.id} organization={org} />
          ))}
      </div>
    </div>
  );
};

export default ClauseJobConnect;
