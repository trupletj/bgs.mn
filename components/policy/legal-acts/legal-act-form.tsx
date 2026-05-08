"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  LegalActCreateTarget,
  LegalActType,
  PolicyPickerPolicy,
  RevisionTargetType,
} from "@/actions/policy-legal-acts";

interface SelectedTarget {
  key: string;
  targetType: RevisionTargetType;
  policyId?: string;
  sectionId?: string;
  clauseId?: string;
  label: string;
  changeNote: string;
}

function targetKey(targetType: RevisionTargetType, id: string) {
  return `${targetType}:${id}`;
}

export function LegalActForm({ policies }: { policies: PolicyPickerPolicy[] }) {
  const router = useRouter();
  const [actType, setActType] = useState<LegalActType>("04");
  const [policyId, setPolicyId] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<SelectedTarget[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPolicy = useMemo(
    () => policies.find((policy) => policy.id === policyId) ?? null,
    [policies, policyId],
  );

  const targetMap = useMemo(
    () => new Map(selectedTargets.map((target) => [target.key, target])),
    [selectedTargets],
  );

  const toggleTarget = (target: Omit<SelectedTarget, "changeNote">) => {
    setSelectedTargets((prev) => {
      if (prev.some((item) => item.key === target.key)) {
        return prev.filter((item) => item.key !== target.key);
      }
      return [...prev, { ...target, changeNote: "" }];
    });
  };

  const updateTargetNote = (key: string, changeNote: string) => {
    setSelectedTargets((prev) =>
      prev.map((target) =>
        target.key === key ? { ...target, changeNote } : target,
      ),
    );
  };

  const handlePolicyChange = (value: string) => {
    setPolicyId(value);
    setSelectedTargets([]);
  };

  const buildTargets = (): LegalActCreateTarget[] =>
    selectedTargets.map((target) => ({
      targetType: target.targetType,
      policyId: target.policyId,
      sectionId: target.sectionId,
      clauseId: target.clauseId,
      changeNote: target.changeNote,
    }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading("Эрх зүйн акт хадгалж байна...");

    try {
      if (actType === "04" && (!policyId || selectedTargets.length === 0)) {
        throw new Error("04 тушаалд журам болон target сонгоно уу");
      }

      const formData = new FormData(event.currentTarget);
      formData.set("act_type", actType);
      formData.set("policy_id", policyId);
      formData.set("revision_targets", JSON.stringify(buildTargets()));

      const response = await fetch("/api/policy/legal-acts", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Эрх зүйн акт хадгалахад алдаа гарлаа");
      }

      toast.success("Эрх зүйн акт хадгалагдлаа");
      router.push(`/policy/legal-acts/${result.id}`);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      toast.dismiss(toastId);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Card className="space-y-4 p-4">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <Label>Тушаалын төрөл</Label>
            <Select value={actType} onValueChange={(value) => setActType(value as LegalActType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="04">04 - Журам шинэчлэх</SelectItem>
                <SelectItem value="03">03 - Сахилгын шийтгэл</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="act_number">Тушаалын дугаар</Label>
              <Input id="act_number" name="act_number" required placeholder="Жишээ: 04/2026-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act_date">Огноо</Label>
              <Input id="act_date" name="act_date" type="date" required />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Гарчиг</Label>
          <Textarea
            id="title"
            name="title"
            required
            maxLength={300}
            placeholder="Тушаалын гарчиг"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body_text">Тушаалын текст</Label>
          <Textarea
            id="body_text"
            name="body_text"
            rows={6}
            placeholder="Тушаалын агуулгыг гараар оруулж болно"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="attachment">Хавсралт файл</Label>
            <div className="flex items-center gap-2">
              <Input
                id="attachment"
                name="attachment"
                type="file"
                accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp"
              />
              <FileUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Тэмдэглэл</Label>
            <Input id="notes" name="notes" placeholder="Дотоод тайлбар" />
          </div>
        </div>
      </Card>

      {actType === "04" && (
        <Card className="space-y-4 p-4">
          <div className="grid gap-4 md:grid-cols-[320px_1fr]">
            <div className="space-y-2">
              <Label>Холбоотой журам</Label>
              <Select value={policyId} onValueChange={handlePolicyChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Журам сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {policy.reference_code ? `${policy.reference_code} · ` : ""}
                      {policy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">Шинэчлэлийн товч тайлбар</Label>
              <Textarea
                id="summary"
                name="summary"
                rows={3}
                placeholder="Журам шинэчлэх болсон үндсэн тайлбар"
              />
            </div>
          </div>

          {selectedPolicy ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Шинэчлэгдсэн зүйлс
                </h2>
                <Badge variant="outline">{selectedTargets.length} сонгосон</Badge>
              </div>

              <div className="rounded-md border">
                <TargetRow
                  checked={targetMap.has(targetKey("policy", selectedPolicy.id))}
                  label="Журмын нэр / ерөнхий мэдээлэл"
                  badge="Журам"
                  note={targetMap.get(targetKey("policy", selectedPolicy.id))?.changeNote ?? ""}
                  onToggle={() =>
                    toggleTarget({
                      key: targetKey("policy", selectedPolicy.id),
                      targetType: "policy",
                      policyId: selectedPolicy.id,
                      label: "Журмын нэр / ерөнхий мэдээлэл",
                    })
                  }
                  onNoteChange={(event) =>
                    updateTargetNote(
                      targetKey("policy", selectedPolicy.id),
                      event.target.value,
                    )
                  }
                />

                {selectedPolicy.sections.map((section) => (
                  <div key={section.id}>
                    <TargetRow
                      checked={targetMap.has(targetKey("section", section.id))}
                      label={`${section.reference_number}. ${section.text}`}
                      badge="Бүлэг"
                      note={targetMap.get(targetKey("section", section.id))?.changeNote ?? ""}
                      onToggle={() =>
                        toggleTarget({
                          key: targetKey("section", section.id),
                          targetType: "section",
                          policyId: selectedPolicy.id,
                          sectionId: section.id,
                          label: section.text,
                        })
                      }
                      onNoteChange={(event) =>
                        updateTargetNote(
                          targetKey("section", section.id),
                          event.target.value,
                        )
                      }
                    />
                    {section.clauses.map((clause) => (
                      <TargetRow
                        key={clause.id}
                        checked={targetMap.has(targetKey("clause", clause.id))}
                        label={`${clause.reference_number}. ${clause.text}`}
                        badge="Заалт"
                        className="pl-9"
                        note={targetMap.get(targetKey("clause", clause.id))?.changeNote ?? ""}
                        onToggle={() =>
                          toggleTarget({
                            key: targetKey("clause", clause.id),
                            targetType: "clause",
                            policyId: selectedPolicy.id,
                            sectionId: section.id,
                            clauseId: clause.id,
                            label: clause.text,
                          })
                        }
                        onNoteChange={(event) =>
                          updateTargetNote(
                            targetKey("clause", clause.id),
                            event.target.value,
                          )
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Журам сонгосны дараа бүлэг, заалтын target гарна
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Цуцлах
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Хадгалах
        </Button>
      </div>
    </form>
  );
}

function TargetRow({
  checked,
  label,
  badge,
  note,
  className,
  onToggle,
  onNoteChange,
}: {
  checked: boolean;
  label: string;
  badge: string;
  note: string;
  className?: string;
  onToggle: () => void;
  onNoteChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div className={`border-b px-3 py-2 last:border-b-0 ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="shrink-0">
              {badge}
            </Badge>
            <p className="min-w-0 text-sm leading-relaxed text-foreground">{label}</p>
          </div>
          {checked && (
            <Input
              value={note}
              onChange={onNoteChange}
              placeholder="Энэ хэсэг хэрхэн шинэчлэгдсэнийг товч бичих"
              className="mt-2"
            />
          )}
        </div>
      </div>
    </div>
  );
}
