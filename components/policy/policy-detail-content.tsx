import { ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
    <Accordion
      type="multiple"
      defaultValue={policy.sections.map((section) => section.id)}
      className="flex flex-col gap-4"
    >
      {policy.sections.map((section) => (
        <AccordionItem key={section.id} value={section.id} className="border-0">
          <Card className="gap-0 overflow-hidden p-0">
            <AccordionTrigger className="border-b border-border bg-muted/30 px-4 py-3 hover:no-underline">
              <div className="flex min-w-0 flex-1 items-baseline gap-3">
                <span className="font-mono text-sm font-bold tabular-nums text-primary">
                  {section.reference_number}
                </span>
                <h3 className="min-w-0 text-sm font-semibold text-foreground">
                  {section.text}
                </h3>
                <span className="shrink-0 text-xs font-normal text-muted-foreground">
                  {section.clauses.length} заалт
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
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
            </AccordionContent>
          </Card>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
