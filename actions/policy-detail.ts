"use server";

import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { sortByReferenceNumber } from "@/lib/policy-utils";

export interface PolicyDetailClause {
  id: string;
  reference_number: string;
  text: string;
  parent_id: string | null;
  policy_id: string;
}

export interface PolicyDetailSection {
  id: string;
  reference_number: string;
  text: string;
  clauses: PolicyDetailClause[];
}

export interface PolicyDetail {
  id: string;
  name: string;
  reference_code: string | null;
  approved_date: string | null;
  sections: PolicyDetailSection[];
}

const fetchDetail = cache(
  async (policy_id: string): Promise<PolicyDetail | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("policy")
      .select(
        `
          id, name, reference_code, approved_date, is_deleted,
          sections:section!policy_id (
            id, reference_number, text, is_deleted,
            clauses:clause!section_id (
              id, reference_number, text, parent_id, policy_id, is_deleted
            )
          )
        `,
      )
      .eq("id", policy_id)
      .eq("is_deleted", false)
      .single();

    if (error || !data) {
      if (error) console.error("[policy-detail]", error.message);
      return null;
    }

    const rawSections = (data.sections as
      | {
          id: string;
          reference_number: string | null;
          text: string;
          is_deleted: boolean;
          clauses: {
            id: string;
            reference_number: string | null;
            text: string;
            parent_id: string | null;
            policy_id: string;
            is_deleted: boolean;
          }[];
        }[]
      | null) ?? [];

    const sections: PolicyDetailSection[] = sortByReferenceNumber(
      rawSections.filter((s) => !s.is_deleted),
    ).map((s) => ({
      id: s.id,
      reference_number: s.reference_number ?? "",
      text: s.text,
      clauses: sortByReferenceNumber(
        (s.clauses ?? [])
          .filter((c) => !c.is_deleted)
          .map((c) => ({
            id: c.id,
            reference_number: c.reference_number ?? "",
            text: c.text,
            parent_id: c.parent_id,
            policy_id: c.policy_id,
          })),
      ),
    }));

    return {
      id: data.id,
      name: data.name,
      reference_code: data.reference_code,
      approved_date: data.approved_date,
      sections,
    };
  },
);

export async function getPolicyDetail(id: string) {
  return fetchDetail(id);
}
