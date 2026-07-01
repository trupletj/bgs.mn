// app/policy/[policy_id]/edit/policy-edit-client.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { Clause } from "@/types/clause";
import PolicyEditerForm from "@/components/policy/PolicyEditorForm";
import { ActionType, PolicyScopeTarget } from "@/types/types";

interface Policy {
  id: string;
  name: string | null;
  referenceCode: string | null;
  approvedDate: string | null;
  scopeTargets?: PolicyScopeTarget[];
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

interface PolicyEditClientProps {
  policyId: string;
}

export default function PolicyEditClient({ policyId }: PolicyEditClientProps) {
  const router = useRouter();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPolicy();
  }, [policyId]);

  const fetchPolicy = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/policy?id=${policyId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Журам олдсонгүй");
      }
      const data: Policy = await response.json();
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
        scopeTargets: policy.scopeTargets ?? [],
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
        router.push(`/policy/${policy.id}`);
      }}
      onCancel={() => {
        router.push(`/policy/${policy.id}`);
      }}
    />
  );
}
