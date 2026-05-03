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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  policyStatusVariant,
  sortByReferenceNumber,
  type JobPositionPerfItem,
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

function OverviewTab({ position }: { position: JobPositionPerfItem }) {
  const variant = policyStatusVariant(position.implementationPercent);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="items-center gap-1 px-4 py-5 text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Холбоотой журам
          </p>
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {position.policies.length}
          </p>
        </Card>
        <Card className="items-center gap-1 px-4 py-5 text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Хэрэгжилт
          </p>
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {position.implementationPercent}%
          </p>
        </Card>
        <Card className="items-center gap-1 px-4 py-5 text-center">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Үнэлсэн
          </p>
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {position.validCount}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / {position.linkedCount}
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
          value={position.implementationPercent}
          indicatorClassName={variant.bar}
          className="h-3"
        />
      </div>

      {position.unitLabel && position.unitLabel !== "—" && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Нэгж</h3>
          <Card className="px-4 py-3 text-sm text-foreground">
            <span className="text-muted-foreground">{position.organizationName || "—"}</span>
            {position.heltesName && (
              <>
                <span className="mx-1 text-muted-foreground">/</span>
                <span>{position.heltesName}</span>
              </>
            )}
            {position.albaName && (
              <>
                <span className="mx-1 text-muted-foreground">/</span>
                <span>{position.albaName}</span>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function PoliciesTab({ position }: { position: JobPositionPerfItem }) {
  if (!position.policies || position.policies.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Холбогдсон журам байхгүй байна
      </p>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      className="space-y-2"
      defaultValue={position.policies[0]?.id}
    >
      {position.policies.map((policy) => (
        <AccordionItem
          key={policy.id}
          value={policy.id}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex w-full items-center gap-3 text-left">
              <span className="flex-1 text-sm font-semibold text-foreground">
                {policy.name}
              </span>
              {policy.reference_code && (
                <span className="font-mono text-xs text-muted-foreground">
                  {policy.reference_code}
                </span>
              )}
              <Badge variant="outline" className="text-xs">
                {policy.clauses.length} заалт
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="border-t border-border bg-muted/20 p-0">
            <TooltipProvider delayDuration={150}>
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-transparent hover:bg-transparent">
                    <TableHead className="w-14">№</TableHead>
                    <TableHead>Заалт</TableHead>
                    <TableHead className="w-32">Төрөл</TableHead>
                    <TableHead className="w-14 text-center">Оноо</TableHead>
                    <TableHead className="w-44">Тайлбар</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortByReferenceNumber(policy.clauses).map((clause) => {
                    const typeLabel =
                      ACTION_TYPES.find((t) => t.value === clause.type)
                        ?.label ||
                      clause.type ||
                      "Тодорхойгүй";
                    return (
                      <TableRow key={String(clause.id)}>
                        <TableCell className="font-mono text-sm font-bold text-primary">
                          <span className="block truncate">
                            {clause.reference_number}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate">
                                {clause.text}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              align="start"
                              className="max-w-md whitespace-normal"
                            >
                              <p className="font-mono text-[11px] opacity-70">
                                {clause.reference_number}
                              </p>
                              <p className="mt-0.5">{clause.text}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="max-w-full truncate text-[11px]"
                          >
                            {typeLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <ScoreBadge score={clause.rating?.score} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {clause.rating?.description ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate">
                                  {clause.rating.description}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="end"
                                className="max-w-md whitespace-normal"
                              >
                                {clause.rating.description}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

interface PositionPerfSheetProps {
  position: JobPositionPerfItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PositionPerfSheet({
  position,
  open,
  onOpenChange,
}: PositionPerfSheetProps) {
  const [tab, setTab] = useState<"overview" | "policies">("overview");

  if (!position) return null;

  const variant = policyStatusVariant(position.implementationPercent);
  const totalClauses = position.policies.reduce(
    (s, p) => s + p.clauses.length,
    0,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
      >
        <SheetHeader className="border-b border-border bg-card px-6 py-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground/60">
            <Briefcase className="h-3.5 w-3.5" />
            Ажлын байр
          </div>
          <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
            {position.name}
          </SheetTitle>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Хэрэгжилт:</span>
              <Badge className={cn("border-transparent", variant.badge)}>
                {position.implementationPercent}%
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Үнэлгээ:</span>
              <span className="font-semibold tabular-nums text-foreground">
                {position.validCount} / {position.linkedCount}
              </span>
            </div>
            {position.unitLabel && position.unitLabel !== "—" && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Нэгж:</span>
                <span className="font-medium text-foreground">
                  {position.unitLabel}
                </span>
              </div>
            )}
          </div>
        </SheetHeader>

        <div className="flex border-b border-border bg-card">
          {(
            [
              { key: "overview", label: "Үзүүлэлт", Icon: FileText },
              {
                key: "policies",
                label: `Журмууд (${position.policies.length} · ${totalClauses} заалт)`,
                Icon: ListChecks,
              },
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
            <OverviewTab position={position} />
          ) : (
            <PoliciesTab position={position} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
