"use client";

import { useState } from "react";
import { Briefcase, FileText, ListChecks } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  policyStatusVariant,
  sortByReferenceNumber,
  type PolicyDashboardItem,
} from "@/lib/policy-utils";

const ACTION_TYPES: { value: string; label: string }[] = [
  { value: "IMPLEMENTATION", label: "Хэрэгжүүлэлт" },
  { value: "MONITORING", label: "Хяналт" },
  { value: "VERIFICATION", label: "Баталгаажуулалт" },
  { value: "DEPLOYMENT", label: "Нэвтрүүлэлт" },
];

function ScoreBadge({ score }: { score: number | undefined }) {
  if (score === undefined) {
    return <span className="text-xs text-muted-foreground">Үнэлгээгүй</span>;
  }
  const cls =
    score >= 5
      ? "bg-emerald-100 text-emerald-700"
      : score >= 3
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums",
        cls,
      )}
    >
      {score}
    </span>
  );
}

function OverviewTab({ policy }: { policy: PolicyDashboardItem }) {
  const variant = policyStatusVariant(policy.implementationPercent);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="items-center gap-1 px-4 py-5 text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Нийт заалт
          </p>
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {policy.clauses.length}
          </p>
        </Card>
        <Card className="items-center gap-1 px-4 py-5 text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Хэрэгжилт
          </p>
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {policy.implementationPercent}%
          </p>
        </Card>
        <Card className="items-center gap-1 px-4 py-5 text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Үнэлсэн
          </p>
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {policy.validCount}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / {policy.checkedCount}
            </span>
          </p>
        </Card>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Хэрэгжилтийн явц
          </h3>
          <Badge className={cn("border-transparent", variant.badge)}>
            {variant.label}
          </Badge>
        </div>
        <Progress
          value={policy.implementationPercent}
          indicatorClassName={variant.bar}
          className="h-3"
        />
      </div>
    </div>
  );
}

function ClausesTab({ policy }: { policy: PolicyDashboardItem }) {
  if (!policy.clauses || policy.clauses.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Заалт байхгүй эсвэл үнэлгээ хийгдээгүй байна
      </p>
    );
  }

  return (
    <Accordion type="single" collapsible className="space-y-2">
      {sortByReferenceNumber(policy.clauses).map((clause) => (
        <AccordionItem
          key={clause.id}
          value={String(clause.id)}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex w-full items-center gap-3 text-left">
              <span className="font-mono text-sm font-bold text-primary">
                {clause.reference_number}
              </span>
              <span className="flex-1 text-sm text-foreground">
                {clause.text}
              </span>
              <Badge variant="outline" className="text-xs">
                {clause.jobPositions.length} байр
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border bg-muted/20 p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-transparent hover:bg-transparent">
                  <TableHead>Ажлын байр</TableHead>
                  <TableHead className="w-44">Төрөл</TableHead>
                  <TableHead className="w-20 text-center">Оноо</TableHead>
                  <TableHead>Тайлбар</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clause.jobPositions.map((jp) => {
                  const typeLabel =
                    ACTION_TYPES.find((t) => t.value === jp.type)?.label ||
                    jp.type ||
                    "Тодорхойгүй";
                  return (
                    <TableRow key={String(jp.id)}>
                      <TableCell className="font-medium text-foreground">
                        {jp.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {typeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <ScoreBadge score={jp.rating?.score} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {jp.rating?.description || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

interface PolicyDetailSheetProps {
  policy: PolicyDashboardItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PolicyDetailSheet({
  policy,
  open,
  onOpenChange,
}: PolicyDetailSheetProps) {
  const [tab, setTab] = useState<"overview" | "clauses">("overview");

  if (!policy) return null;

  const variant = policyStatusVariant(policy.implementationPercent);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
      >
        <SheetHeader className="border-b border-border bg-card px-6 py-5">
          <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
            {policy.name}
          </SheetTitle>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Хэрэгжилт:</span>
              <Badge className={cn("border-transparent", variant.badge)}>
                {policy.implementationPercent}%
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Үнэлгээ:</span>
              <span className="font-semibold tabular-nums text-foreground">
                {policy.validCount} / {policy.checkedCount}
              </span>
            </div>
            {policy.reference_code && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Код:</span>
                <span className="font-mono text-xs">
                  {policy.reference_code}
                </span>
              </div>
            )}
          </div>
        </SheetHeader>

        <div className="flex border-b border-border bg-card">
          {(
            [
              { key: "overview", label: "Үзүүлэлт", Icon: FileText },
              { key: "clauses", label: `Заалтууд (${policy.clauses.length})`, Icon: ListChecks },
            ] as const
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors",
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto bg-muted/10 p-6">
          {tab === "overview" ? (
            <OverviewTab policy={policy} />
          ) : (
            <ClausesTab policy={policy} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
