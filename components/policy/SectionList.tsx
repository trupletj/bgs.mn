import React from "react";
import { createClient } from "@/utils/supabase/client";
import ClauseList from "./ClauseList";
import { getSections } from "@/actions/section";

const SectionList = async ({ policy_id }: { policy_id: string }) => {
  const sections = await getSections({ policy_id });

  return (
    <div>
      {sections?.map((section) => (
        <div key={section.id + "section-list"}>
          <div className="font-semibold flex flex-row gap-5 m-2">
            <div>{section.reference_number + "."}</div>
            <div>{section.text}</div>
          </div>
          <ClauseList section_id={section.id} />
        </div>
      ))}
    </div>
  );
};

export default SectionList;
