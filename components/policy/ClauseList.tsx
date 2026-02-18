import { getClauses } from "@/actions/clause";
import SingleClause from "./SingleClause";
import { hasRole } from "@/actions/rbac";

const ClauseList = async ({ section_id }: { section_id: string }) => {
  const clauses = await getClauses({ section_id });
  const isRating = await hasRole(["super_admin", "monitoring_emp"]);

  return (
    <div>
      {clauses?.map((clause) => (
        <SingleClause
          key={clause.id + "single-clause"}
          clause={clause}
          isRating={isRating}
        />
      ))}
    </div>
  );
};

export default ClauseList;
