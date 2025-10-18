"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { Clause } from "@/types/clause";
import PolicyEditerForm from "@/components/policy/PolicyEditorForm";
import { ActionType } from "@/types/types";

interface Policy {
  id: string;
  name: string | null;
  referenceCode: string | null;
  approvedDate: string | null;
  section?: Array<{
    id: string;
    referenceNumber: string;
    text?: string | null;
    policyId: string;
    clause?: Array<{
      id: string;
      referenceNumber: string;
      text: string;
      sectionId: string;
      parentId: string | null;
      policyId: string | null;
      children?: Clause[];
      clause_position?: {
        positionId: string;
        type: ActionType;
      }[];
    }>;
  }>;
}

interface PolicyEditPageProps {
  params: Promise<{ policy_id: string }>;
}

export default function PolicyEditPageWithPositionLink({
  params,
}: PolicyEditPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPolicy();
  }, [resolvedParams.policy_id]);

  const fetchPolicy = async () => {
    setIsLoading(true);
    try {
      console.log("Fetching policy for edit:", {
        policyId: resolvedParams.policy_id,
      });
      const response = await fetch(
        `/api/policy?id=${resolvedParams.policy_id}`,
        {
          cache: "no-store",
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Журам олдсонгүй");
      }
      const data: Policy = await response.json();
      console.log(data);
      console.log("Policy fetched for edit:", {
        id: data.id,
        referenceCode: data.referenceCode,
        name: data.name,
        section: data.section?.length,
      });
      setPolicy(data);
    } catch (error) {
      console.error("Failed to fetch policy:", error);
      throw notFound();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Ачаалж байна...</div>;
  }

  if (!policy) {
    throw notFound();
  }

  return (
    <PolicyEditerForm
      initialData={{
        id: policy.id,
        name: policy.name || "",
        referenceCode: policy.referenceCode || "",
        approvedDate: policy.approvedDate
          ? new Date(policy.approvedDate)
          : null,
        sections: (policy.section ?? []).map((s) => ({
          id: s.id,
          policyId: s.policyId,
          referenceNumber: s.referenceNumber,
          text: s.text || "",
          clauses: (s.clause ?? []).map((c) => ({
            id: c.id,
            policyId: c.policyId || policy.id,
            referenceNumber: c.referenceNumber,
            text: c.text,
            sectionId: c.sectionId,
            parentId: c.parentId,
            children: c.children ?? [],
            positions: c.clause_position ?? [],
          })),
        })),
      }}
      onSuccess={() => {
        console.log("Policy updated:", { policyId: policy.id });
        router.push(`/policy/${policy.id}`);
      }}
      onCancel={() => {
        console.log("Edit mode cancelled:", { policyId: policy.id });
        router.push(`/policy/${policy.id}`);
      }}
    />
  );
}
