// components/NewPolicy.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Policy, Clause } from "@/types/types";
import { PolicyHeader } from "./PolicyHeader";
import { SectionItem } from "./SectionItem";
import { Button } from "@/components/ui/button";
import { createPolicy, createSection, createClause } from "@/actions/policy";

export const NewPolicy = () => {
  const router = useRouter();
  const [policyData, setPolicyData] = useState<Policy>({
    name: "",
    reference_code: "",
    approved_date: null,
    section: [],
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper functions
  const updateClauseNumbers = useCallback(
    (clause: Clause[], parentRef: string): Clause[] =>
      clause.map((clause, idx) => ({
        ...clause,
        reference_number: `${parentRef}.${idx + 1}`,
        children: updateClauseNumbers(
          clause.children ?? [],
          `${parentRef}.${idx + 1}`
        ),
      })),
    []
  );

  // Section management
  const addSection = useCallback(() => {
    if (isProcessing) return;
    setPolicyData((prev) => ({
      ...prev,
      section: [
        ...prev.section,
        {
          reference_number: `${prev.section.length + 1}`,
          text: "",
          clause: [],
        },
      ],
    }));
  }, [isProcessing]);

  const insertSectionBefore = useCallback(
    (sectionIndex: number) => {
      if (isProcessing) return;
      setPolicyData((prev) => {
        const newSections = [...prev.section];
        newSections.splice(sectionIndex, 0, {
          reference_number: `${sectionIndex + 1}`,
          text: "",
          clause: [],
        });
        return {
          ...prev,
          section: newSections.map((section, idx) => ({
            ...section,
            reference_number: `${idx + 1}`,
            clause: updateClauseNumbers(section.clause, `${idx + 1}`),
          })),
        };
      });
    },
    [isProcessing, updateClauseNumbers]
  );

  const deleteSection = useCallback(
    (sectionIndex: number) => {
      if (isProcessing) return;
      setPolicyData((prev) => ({
        ...prev,
        section: prev.section
          .filter((_, idx) => idx !== sectionIndex)
          .map((section, idx) => ({
            ...section,
            reference_number: `${idx + 1}`,
            clause: updateClauseNumbers(section.clause, `${idx + 1}`),
          })),
      }));
    },
    [isProcessing, updateClauseNumbers]
  );

  const updateSectionText = useCallback(
    (sectionIndex: number, text: string) => {
      if (isProcessing) return;
      setPolicyData((prev) => {
        const newSections = [...prev.section];
        newSections[sectionIndex] = { ...newSections[sectionIndex], text };
        return { ...prev, section: newSections };
      });
    },
    [isProcessing]
  );

  const addClause = useCallback(
    (sectionIndex: number) => {
      if (isProcessing) return;
      setPolicyData((prev) => {
        const newSections = [...prev.section];
        const section = { ...newSections[sectionIndex] };
        const newClause = {
          text: "",
          reference_number: `${section.reference_number}.${
            section.clause.length + 1
          }`,
          children: [],
        };
        section.clause = [...section.clause, newClause];
        newSections[sectionIndex] = section;
        return { ...prev, section: newSections };
      });
    },
    [isProcessing]
  );

  // Insert Clause Before
  const insertClauseBefore = useCallback(
    (sectionIndex: number, path: number[]) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setPolicyData((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev.section));
        const section = newSections[sectionIndex];
        let current = section.clause;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]].children!;
        }
        const insertIndex = path[path.length - 1];
        const parentRef =
          path.length === 1
            ? section.reference_number
            : current[0]?.reference_number.split(".").slice(0, -1).join(".") ??
              section.reference_number;
        const newClause = {
          text: "",
          reference_number: `${parentRef}.${insertIndex + 1}`,
          children: [],
        };
        current.splice(insertIndex, 0, newClause);
        if (path.length === 1) {
          section.clause = updateClauseNumbers(current, parentRef);
        } else {
          let parent = section.clause;
          for (let i = 0; i < path.length - 2; i++) {
            parent = parent[path[i]].children!;
          }
          parent[path[path.length - 2]] = {
            ...parent[path[path.length - 2]],
            children: updateClauseNumbers(current, parentRef),
          };
        }
        newSections[sectionIndex] = section;
        return { ...prev, section: newSections };
      });
      setIsProcessing(false);
    },
    [isProcessing, updateClauseNumbers]
  );

  // Add Sub-Clause
  const addSubClause = useCallback(
    (sectionIndex: number, path: number[]) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setPolicyData((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev.section));
        const section = newSections[sectionIndex];
        let current = section.clause;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]].children!;
        }
        const parentClause = current[path[path.length - 1]];
        const newSubClause = {
          text: "",
          reference_number: `${parentClause.reference_number}.${
            (parentClause.children?.length ?? 0) + 1
          }`,
          children: [],
        };
        parentClause.children = [
          ...(parentClause.children ?? []),
          newSubClause,
        ];
        newSections[sectionIndex] = section;
        return { ...prev, section: newSections };
      });
      setIsProcessing(false);
    },
    [isProcessing]
  );

  // Update Clause Text
  const updateClauseText = useCallback(
    (sectionIndex: number, path: number[], text: string) => {
      if (isProcessing) return;
      setPolicyData((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev.section));
        const section = newSections[sectionIndex];
        let current = section.clause;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]].children!;
        }
        current[path[path.length - 1]] = {
          ...current[path[path.length - 1]],
          text,
        };
        newSections[sectionIndex] = section;
        return { ...prev, section: newSections };
      });
    },
    [isProcessing]
  );

  // Delete Clause
  const deleteClause = useCallback(
    (sectionIndex: number, path: number[]) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setPolicyData((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev.section));
        const section = newSections[sectionIndex];
        let current = section.clause;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]].children!;
        }
        current.splice(path[path.length - 1], 1);
        const parentRef =
          path.length === 1
            ? section.reference_number
            : current.length > 0
            ? current[0].reference_number.split(".").slice(0, -1).join(".")
            : section.reference_number;
        if (path.length === 1) {
          section.clause = updateClauseNumbers(current, parentRef);
        } else {
          let parent = section.clause;
          for (let i = 0; i < path.length - 2; i++) {
            parent = parent[path[i]].children!;
          }
          parent[path[path.length - 2]] = {
            ...parent[path[path.length - 2]],
            children: updateClauseNumbers(current, parentRef),
          };
        }
        newSections[sectionIndex] = section;
        return { ...prev, section: newSections };
      });
      setIsProcessing(false);
    },
    [isProcessing, updateClauseNumbers]
  );

  // NewPolicy компонент дотор
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    setIsProcessing(true);
    const toastId = toast.loading("Журам хадгалж байна...");

    try {
      // Validation
      if (!policyData.name || !policyData.reference_code) {
        throw new Error("Журмын нэр болон дугаар заавал оруулна уу");
      }

      // 1. Журам хадгалах
      const policy = await createPolicy({
        name: policyData.name,
        reference_code: policyData.reference_code,
        approved_date: policyData.approved_date,
      });

      // 2. Бүлэг болон заалтуудыг хадгалах
      for (const section of policyData.section) {
        const createdSection = await createSection({
          policy_id: policy.id,
          text: section.text,
          reference_number: section.reference_number,
        });

        // 3. Заалтуудыг рекурсив байдлаар хадгалах
        const createClauses = async (clauses: Clause[], parentId?: string) => {
          for (const clause of clauses) {
            const createdClause = await createClause({
              text: clause.text,
              reference_number: clause.reference_number,
              section_id: createdSection.id,
              parent_id: parentId,
              policy_id: policy.id,
            });

            if (clause.children && clause.children.length > 0) {
              await createClauses(clause.children, createdClause.id);
            }
          }
        };

        await createClauses(section.clause);
      }
      toast.success("Журмыг амжилттай бүртгэлээ");
      toast.dismiss(toastId);

      setTimeout(() => router.push("/policy"), 1000);
    } catch (error) {
      console.error("Submit error:", error);

      // Error үед toast-ыг зөв хаах
      toast.dismiss(toastId);
      toast.error(`Алдаа: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full mx-auto p-6">
      <PolicyHeader
        policyData={policyData}
        setPolicyData={setPolicyData}
        isProcessing={isProcessing}
        onSubmit={handleSubmit}
      />

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Бүлгүүд</h2>
          <Button
            type="button"
            variant="outline"
            onClick={addSection}
            disabled={isProcessing}
            aria-label="Бүлэг нэмэх">
            + Бүлэг нэмэх
          </Button>
        </div>

        {policyData.section.map((section, sectionIndex) => (
          <SectionItem
            key={section.id || sectionIndex}
            section={section}
            sectionIndex={sectionIndex}
            updateSectionText={updateSectionText}
            addClause={addClause}
            insertSectionBefore={insertSectionBefore}
            deleteSection={deleteSection}
            updateClauseText={updateClauseText}
            addSubClause={addSubClause}
            insertClauseBefore={insertClauseBefore}
            deleteClause={deleteClause}
            isProcessing={isProcessing}
          />
        ))}
      </div>
    </div>
  );
};

export default NewPolicy;
