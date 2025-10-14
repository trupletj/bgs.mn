// import { getAllSortedClauses } from "@/action/ClauseService";
import { getClauses } from "@/actions/clause";
import React from "react";
import SingleClause from "./SingleClause";

const ClauseList = async ({ section_id }: { section_id: string }) => {
  const clauses = await getClauses({ section_id });

  return (
    <div>
      {clauses?.map((clause) => (
        <SingleClause key={clause.id + "single-clause"} clause={clause} />
      ))}
    </div>
  );
};

export default ClauseList;
