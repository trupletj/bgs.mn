"use client";

import { useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Button } from "@/components/ui/button";
import ClauseItemEdit from "./ClauseItemEdit";
import { Clause, Section } from "@/types/clause";
import { ActionType, PolicyScopeTarget } from "@/types/types";
import { PolicyScopeSelector } from "./policy-scope-selector";

interface PolicyFormData {
  name: string;
  referenceCode: string;
  approvedDate: Date | null;
}

interface PolicyFormProps {
  initialData?: {
    id: string;
    name: string;
    referenceCode: string;
    approvedDate: Date | null;
    scopeTargets?: PolicyScopeTarget[];
    sections: Array<{
      id: string;
      policyId?: string;
      referenceNumber: string;
      text: string;
      clauses: Array<{
        id: string;
        policyId?: string;
        referenceNumber: string;
        text: string;
        sectionId?: string;
        parentId?: string | null;
        children?: Clause[];
        positions?: { positionId: string; type: ActionType }[];
      }>;
    }>;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PolicyEditerForm({
  initialData,
  onSuccess,
  onCancel,
}: PolicyFormProps) {
  const [policyData, setPolicyData] = useState<PolicyFormData>({
    name: initialData?.name || "",
    referenceCode: initialData?.referenceCode || "",
    approvedDate: initialData?.approvedDate || null,
  });
  const [scopeTargets, setScopeTargets] = useState<PolicyScopeTarget[]>(
    initialData?.scopeTargets ?? [],
  );
  const [sections, setSections] = useState<Section[]>(
    initialData?.sections.map((s) => ({
      ...s,
      policyId: s.policyId || initialData.id,
      clauses: s.clauses.map((c) => ({
        ...c,
        policyId: c.policyId || initialData.id,
      })),
    })) || [],
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const updateClauseNumbers = useCallback((
    clauses: Clause[],
    parentRef: string,
  ): Clause[] => {
    return clauses.map((clause, idx) => ({
      ...clause,
      referenceNumber: `${parentRef}.${idx + 1}`,
      children: updateClauseNumbers(
        clause.children ?? [],
        `${parentRef}.${idx + 1}`,
      ),
    }));
  }, []);

  const addSection = useCallback(() => {
    if (isProcessing) return;
    setIsProcessing(true);
    setSections((prev) => [
      ...prev,
      {
        referenceNumber: `${prev.length + 1}`,
        text: "",
        clauses: [],
        policyId: initialData?.id,
      },
    ]);
    setIsProcessing(false);
  }, [isProcessing, initialData?.id]);

  const insertSectionBefore = useCallback(
    (sectionIndex: number) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setSections((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev));
        newSections.splice(sectionIndex, 0, {
          referenceNumber: `${sectionIndex + 1}`,
          text: "",
          clauses: [],
          policyId: initialData?.id,
        });
        return newSections.map(
          (section: { clauses: Clause[] }, idx: number) => ({
            ...section,
            referenceNumber: `${idx + 1}`,
            clauses: updateClauseNumbers(section.clauses, `${idx + 1}`),
          }),
        );
      });
      setIsProcessing(false);
    },
    [isProcessing, initialData?.id, updateClauseNumbers],
  );

  const deleteSection = useCallback((sectionIndex: number) => {
    if (!confirm("Бүлгийг устгахдаа итгэлтэй байна уу?")) return;
    setIsProcessing(true);
    setSections((prev) => {
      return prev
        .filter((_, idx) => idx !== sectionIndex)
        .map((s, idx) => ({
          ...s,
          referenceNumber: `${idx + 1}`,
          clauses: updateClauseNumbers(s.clauses, `${idx + 1}`),
        }));
    });
    console.log("Section deleted (UI only)");
    setIsProcessing(false);
  }, [updateClauseNumbers]);

  const addClause = useCallback(
    (sectionIndex: number) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setSections((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev));
        const section = newSections[sectionIndex];
        const newClause: Clause = {
          text: "",
          referenceNumber: `${section.referenceNumber}.${
            section.clauses.length + 1
          }`,
          sectionId: section.id,
          policyId: section.policyId,
          children: [],
          positions: [],
        };
        section.clauses = [...section.clauses, newClause];

        return newSections;
      });
      setIsProcessing(false);
    },
    [isProcessing],
  );

  const insertClauseBefore = useCallback(
    (sectionIndex: number, path: number[]) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setSections((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev));
        const section = newSections[sectionIndex];
        let current = section.clauses;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]].children!;
        }
        const insertIndex = path[path.length - 1];
        const parentRef =
          path.length === 1
            ? section.referenceNumber
            : (current[0]?.referenceNumber.split(".").slice(0, -1).join(".") ??
              section.referenceNumber);
        const newClause: Clause = {
          text: "",
          referenceNumber: `${parentRef}.${insertIndex + 1}`,
          sectionId: section.id,
          policyId: section.policyId,
          children: [],
          positions: [],
        };
        current.splice(insertIndex, 0, newClause);
        if (path.length === 1) {
          section.clauses = updateClauseNumbers(current, parentRef);
        } else {
          let parent = section.clauses;
          for (let i = 0; i < path.length - 2; i++) {
            parent = parent[path[i]].children!;
          }
          parent[path[path.length - 2]] = {
            ...parent[path[path.length - 2]],
            children: updateClauseNumbers(current, parentRef),
          };
        }
        newSections[sectionIndex] = section;
        console.log("Clause inserted before:", {
          section: section.referenceNumber,
          clause: newClause.referenceNumber,
        });
        return newSections;
      });
      setIsProcessing(false);
    },
    [isProcessing, updateClauseNumbers],
  );

  const addSubClause = useCallback(
    (sectionIndex: number, path: number[]) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setSections((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev));
        const section = newSections[sectionIndex];
        let current = section.clauses;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]].children!;
        }
        const parentClause = current[path[path.length - 1]];
        const newSubClause: Clause = {
          text: "",
          referenceNumber: `${parentClause.referenceNumber}.${
            (parentClause.children?.length ?? 0) + 1
          }`,
          sectionId: section.id,
          policyId: section.policyId,
          children: [],
          positions: [],
        };
        parentClause.children = [
          ...(parentClause.children ?? []),
          newSubClause,
        ];
        console.log("New sub-clause added:", {
          parentClause: parentClause.referenceNumber,
          subClause: newSubClause.referenceNumber,
        });
        return newSections;
      });
      setIsProcessing(false);
    },
    [isProcessing],
  );

  const updateSectionText = useCallback(
    (sectionIndex: number, text: string) => {
      setSections((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev));
        newSections[sectionIndex] = { ...newSections[sectionIndex], text };
        console.log("Section text updated:", {
          referenceNumber: newSections[sectionIndex].referenceNumber,
          text: text.substring(0, 20) + (text.length > 20 ? "..." : ""),
        });
        return newSections;
      });
    },
    [],
  );

  const updateClauseText = useCallback(
    (sectionIndex: number, path: number[], text: string) => {
      if (isProcessing) return;
      setSections((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev));
        const section = newSections[sectionIndex];
        let current = section.clauses;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]].children!;
        }
        current[path[path.length - 1]] = {
          ...current[path[path.length - 1]],
          text,
        };
        console.log("Clause text updated:", {
          referenceNumber: current[path[path.length - 1]].referenceNumber,
          text: text.substring(0, 20) + (text.length > 20 ? "..." : ""),
        });
        return newSections;
      });
    },
    [isProcessing],
  );

  const updateClausePositions = useCallback(
    (
      sectionIndex: number,
      path: number[],
      positions: { positionId: string; type: ActionType }[],
    ) => {
      setSections((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev));
        const section = newSections[sectionIndex];
        let current = section.clauses;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]].children!;
        }
        current[path[path.length - 1]] = {
          ...current[path[path.length - 1]],
          positions,
        };
        console.log("Clause positions updated:", {
          referenceNumber: current[path[path.length - 1]].referenceNumber,
          positions: positions.length,
        });
        return newSections;
      });
    },
    [],
  );

  const deleteClause = useCallback(
    (sectionIndex: number, path: number[]) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setSections((prev) => {
        const newSections = JSON.parse(JSON.stringify(prev));
        const section = newSections[sectionIndex];
        let current = section.clauses;
        for (let i = 0; i < path.length - 1; i++) {
          current = current[path[i]].children!;
        }
        const deletedClause = current[path[path.length - 1]];
        current.splice(path[path.length - 1], 1);
        const parentRef =
          path.length === 1
            ? section.referenceNumber
            : current.length > 0
              ? current[0].referenceNumber.split(".").slice(0, -1).join(".")
              : section.referenceNumber;
        if (path.length === 1) {
          section.clauses = updateClauseNumbers(current, parentRef);
        } else {
          let parent = section.clauses;
          for (let i = 0; i < path.length - 2; i++) {
            parent = parent[path[i]].children!;
          }
          parent[path[path.length - 2]] = {
            ...parent[path[path.length - 2]],
            children: updateClauseNumbers(current, parentRef),
          };
        }
        newSections[sectionIndex] = section;
        console.log("Clause deleted:", {
          referenceNumber: deletedClause.referenceNumber,
          remainingClauses: current.length,
        });
        return newSections;
      });
      setIsProcessing(false);
    },
    [isProcessing, updateClauseNumbers],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    const toastId = toast.loading("Журам хадгалж байна...");

    try {
      if (!policyData.name || !policyData.referenceCode) {
        throw new Error("Журмын нэр болон дугаар заавал оруулна уу");
      }

      const requestBody = {
        name: policyData.name,
        reference_code: policyData.referenceCode,
        approved_date: policyData.approvedDate,
        scope_targets: scopeTargets,
        sections,
      };

      const method = initialData ? "PUT" : "POST";
      const url = initialData
        ? `/api/policy/document?id=${initialData.id}`
        : `/api/policy`;
      const policyResponse = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!policyResponse.ok) {
        const error = await policyResponse.json();
        throw new Error(error.error || "Журам хадгалахад алдаа гарлаа");
      }
      const policy = await policyResponse.json();

      toast.success(`Журам амжилттай засварлагдлаа`);
      toast.dismiss(toastId);
      console.log("Form submission successful", {
        id: policy.id,
        sections: policy.sectionCount,
        clauses: policy.clauseCount,
      });
      onSuccess();
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(`Алдаа: ${(error as Error).message}`);
      toast.dismiss(toastId);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full mx-auto p-6">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            {initialData ? "Журам Засварлах" : "Шинэ Журам Үүсгэх"}
          </h1>
          <div className="flex gap-2">
            {initialData && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isProcessing}
                aria-label="Цуцлах">
                Цуцлах
              </Button>
            )}
            <Button type="submit" disabled={isProcessing} aria-label="Хадгалах">
              Хадгалах
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap my-4 container w-full shadow-md p-3 justify-between gap-4">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-gray-700">
              Журмын дугаар
            </label>
            <Input
              required
              value={policyData.referenceCode}
              onChange={(e) =>
                setPolicyData((prev) => ({
                  ...prev,
                  referenceCode: e.target.value,
                }))
              }
              className="mt-1 p-2 w-full border border-gray-300 rounded"
              placeholder="Журмын дугаарыг оруулна уу"
              disabled={isProcessing}
            />
          </div>

          <div className="flex-1 min-w-[400px]">
            <label className="block text-sm font-medium text-gray-700">
              Журмын нэр
            </label>
            <Textarea
              required
              value={policyData.name}
              onChange={(e) =>
                setPolicyData((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              className="mt-1 p-2 w-full border border-gray-300 rounded"
              placeholder="Журмын нэрийг оруулна уу"
              maxLength={250}
              disabled={isProcessing}
            />
          </div>

          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-gray-700">
              Журмын баталсан огноо
            </label>
            <DatePicker
              selected={policyData.approvedDate}
              onChange={(date: Date | null) =>
                setPolicyData((prev) => ({
                  ...prev,
                  approvedDate: date,
                }))
              }
              dateFormat="yyyy/MM/dd"
              placeholderText="Журмын баталсан огноо"
              className="mt-1 p-2 w-full border border-gray-300 rounded"
              disabled={isProcessing}
            />
          </div>
        </div>

        <PolicyScopeSelector
          value={scopeTargets}
          onChange={setScopeTargets}
          disabled={isProcessing}
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

          {sections.map((section, sectionIndex) => (
            <div key={section.id || sectionIndex}>
              {sectionIndex >= 0 && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => insertSectionBefore(sectionIndex)}
                  disabled={isProcessing}
                  className="mb-2"
                  aria-label="Бүлэг нэмэх (өмнө)">
                  + Бүлэг нэмэх (өмнө)
                </Button>
              )}
              <div className="mt-4 p-4 border rounded">
                <div className="flex items-center gap-4">
                  <span className="font-bold">{section.referenceNumber}.</span>
                  <Textarea
                    value={section.text}
                    onChange={(e) =>
                      updateSectionText(sectionIndex, e.target.value)
                    }
                    placeholder="Бүлгийн текст оруулна уу"
                    className="flex-1 p-2 border rounded"
                    disabled={isProcessing}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => deleteSection(sectionIndex)}
                    disabled={isProcessing}
                    aria-label="Бүлэг устгах">
                    - Устгах
                  </Button>
                </div>

                <div className="ml-6 mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Заалтууд</h3>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => addClause(sectionIndex)}
                      disabled={isProcessing}
                      aria-label="Заалт нэмэх">
                      + Заалт нэмэх
                    </Button>
                  </div>

                  {section.clauses.map((clause, clauseIndex) => (
                    <ClauseItemEdit
                      key={clause.id || `${sectionIndex}-${clauseIndex}`}
                      sectionIndex={sectionIndex}
                      clause={clause}
                      clauseIndex={clauseIndex}
                      path={[clauseIndex]}
                      updateClauseText={updateClauseText}
                      updateClausePositions={updateClausePositions}
                      addSubClause={addSubClause}
                      insertClauseBefore={insertClauseBefore}
                      deleteClause={deleteClause}
                      parentRefNumber={section.referenceNumber}
                      level={1}
                      isProcessing={isProcessing}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
