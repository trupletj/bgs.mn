import { ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import SingleClause from "@/components/policy/SingleClause";
import type { PolicyDetail } from "@/actions/policy-detail";

export function PolicyDetailContent({
  policy,
  isRating,
}: {
  policy: PolicyDetail;
  isRating: boolean;
}) {
  if (policy.sections.length === 0) {
    return (
      <Card className="items-center gap-2 px-4 py-12 text-center">
        <ListChecks className="h-8 w-8 text-muted-foreground/50" />
        <p className="font-semibold text-foreground">
          Бүлэг бүртгэгдээгүй байна
        </p>
        <p className="text-sm text-muted-foreground">
          Журамд дор хаяж нэг бүлэг + заалт нэмэх шаардлагатай
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {policy.sections.map((section) => (
        <Card key={section.id} className="gap-0 p-0">
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-sm font-bold tabular-nums text-primary">
                {section.reference_number}
              </span>
              <h3 className="text-sm font-semibold text-foreground">
                {section.text}
              </h3>
            </div>
          </div>
          {section.clauses.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Заалт байхгүй
            </p>
          ) : (
            <div className="flex flex-col py-2">
              {section.clauses.map((clause) => (
                <SingleClause
                  key={clause.id}
                  clause={clause}
                  isRating={isRating}
                />
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
