"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  ArrowRight,
  ChevronDown,
  GitBranch,
} from "lucide-react";
import { UNIT_OPTIONS } from "@/types";
import { cn } from "@/lib/utils";

interface Reviewer {
  id: number;
  status: string;
  reviewed_at?: string;
  comment?: string;
  profile?: { name: string; position_name?: string };
  sub_order_items?: Array<{
    id: number;
    order_item_id: number;
    quantity: number;
    description?: string;
  }>;
  order_steps?: { step_name: string; step_order: number };
}

interface Step {
  step_order: number;
  step_name: string;
  reviewers: Reviewer[];
}

interface OrderWorkflowProps {
  reviewers: Reviewer[];
  items: any[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; dot: string; badge: string }> = {
  approved: {
    label: "Зөвшөөрсөн",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "Татгалзсан",
    icon: <XCircle className="h-4 w-4 text-red-600" />,
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200",
  },
  changes_requested: {
    label: "Өөрчлөлт хүссэн",
    icon: <AlertCircle className="h-4 w-4 text-amber-600" />,
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  skipped: {
    label: "Алгассан",
    icon: <Clock className="h-4 w-4 text-slate-400" />,
    dot: "bg-slate-300",
    badge: "bg-slate-50 text-slate-500 border-slate-200",
  },
  pending: {
    label: "Хүлээгдэж байна",
    icon: <Clock className="h-4 w-4 text-blue-500" />,
    dot: "bg-blue-400",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}

function stepStatus(reviewers: Reviewer[]): string {
  if (reviewers.every((r) => r.status === "approved")) return "approved";
  if (reviewers.some((r) => r.status === "rejected")) return "rejected";
  if (reviewers.some((r) => r.status === "changes_requested")) return "changes_requested";
  if (reviewers.some((r) => r.status === "approved")) return "approved";
  return "pending";
}

function formatDate(d?: string) {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

function getUnitLabel(unit: string) {
  return UNIT_OPTIONS.find((o) => o.value === unit)?.label ?? unit;
}

export function OrderWorkflow({ reviewers, items }: OrderWorkflowProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Group reviewers by step_order
  const stepsMap = new Map<number, Step>();
  for (const r of reviewers) {
    const order = r.order_steps?.step_order ?? 0;
    if (!stepsMap.has(order)) {
      stepsMap.set(order, {
        step_order: order,
        step_name: r.order_steps?.step_name ?? `Алхам ${order}`,
        reviewers: [],
      });
    }
    stepsMap.get(order)!.reviewers.push(r);
  }
  const steps = Array.from(stepsMap.values()).sort((a, b) => a.step_order - b.step_order);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (steps.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Баталгаажуулалтын явц</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Явцын түүх байхгүй</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Баталгаажуулалтын явц</h2>
        <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
          {steps.length} алхам
        </span>
      </div>

      <div className="p-5">
        <div className="relative flex flex-col gap-0">
          {steps.map((step, si) => {
            const overall = stepStatus(step.reviewers);
            const cfg = getStatusCfg(overall);
            const isLast = si === steps.length - 1;

            return (
              <div key={step.step_order} className="relative flex gap-4">
                {/* Timeline spine */}
                <div className="flex flex-col items-center">
                  {/* Step dot */}
                  <div className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-background shadow-sm",
                    overall === "approved" ? "bg-emerald-100" :
                    overall === "rejected"  ? "bg-red-100" :
                    overall === "changes_requested" ? "bg-amber-100" :
                    "bg-blue-50"
                  )}>
                    {cfg.icon}
                  </div>
                  {/* Connecting line */}
                  {!isLast && (
                    <div className="w-px flex-1 bg-border/60 my-1" />
                  )}
                </div>

                {/* Step content */}
                <div className={cn("min-w-0 flex-1", !isLast && "pb-6")}>
                  {/* Step header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
                      {step.step_order}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{step.step_name}</span>
                    <Badge variant="outline" className={cn("ml-auto text-xs px-2 py-0.5", cfg.badge)}>
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Reviewers */}
                  <div className="flex flex-col gap-2">
                    {step.reviewers.map((r) => {
                      const rcfg = getStatusCfg(r.status || "pending");
                      const hasChanges = (r.sub_order_items?.length ?? 0) > 0;
                      const isOpen = expanded.has(r.id);
                      const reviewedDate = formatDate(r.reviewed_at);

                      return (
                        <div
                          key={r.id}
                          className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden"
                        >
                          <div
                            className={cn(
                              "flex items-start gap-3 px-4 py-3",
                              (hasChanges || r.comment) && "cursor-pointer hover:bg-muted/40 transition-colors"
                            )}
                            onClick={() => (hasChanges || r.comment) && toggle(r.id)}
                          >
                            {/* Reviewer avatar */}
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {r.profile?.name?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "?"}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium text-foreground">
                                  {r.profile?.name || "Нэр байхгүй"}
                                </span>
                                {r.profile?.position_name && (
                                  <span className="text-xs text-muted-foreground">
                                    · {r.profile.position_name}
                                  </span>
                                )}
                                <Badge variant="outline" className={cn("ml-auto text-xs px-1.5 py-0", rcfg.badge)}>
                                  {rcfg.label}
                                </Badge>
                              </div>

                              {reviewedDate && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {reviewedDate}
                                </p>
                              )}
                            </div>

                            {(hasChanges || r.comment) && (
                              <ChevronDown className={cn(
                                "h-4 w-4 shrink-0 text-muted-foreground transition-transform mt-0.5",
                                isOpen && "rotate-180"
                              )} />
                            )}
                          </div>

                          {/* Expanded: comment + changes */}
                          {isOpen && (
                            <div className="border-t border-border/40 px-4 py-3 space-y-3">
                              {r.comment && (
                                <div className="rounded-md bg-background px-3 py-2 text-sm">
                                  <span className="font-medium text-foreground">Тайлбар: </span>
                                  <span className="text-muted-foreground">{r.comment}</span>
                                </div>
                              )}

                              {hasChanges && (
                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Өөрчилсөн тоо хэмжээ
                                  </p>
                                  <div className="flex flex-col gap-1.5">
                                    {r.sub_order_items!.map((sub) => {
                                      const orig = items.find((it) => it.id === sub.order_item_id);
                                      const unit = getUnitLabel(orig?.unit || "");
                                      return (
                                        <div
                                          key={sub.id}
                                          className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                                        >
                                          <span className="font-medium text-foreground truncate mr-2">
                                            {orig?.part_name ?? `#${sub.order_item_id}`}
                                          </span>
                                          <div className="flex items-center gap-1.5 shrink-0 text-sm">
                                            <span className="text-muted-foreground line-through">
                                              {orig?.quantity} {unit}
                                            </span>
                                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                            <span className="font-semibold text-amber-700">
                                              {sub.quantity} {unit}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {r.sub_order_items!.some((s) => items.find((it) => it.id === s.order_item_id)?.description) && (
                                    <div className="mt-2 space-y-1">
                                      {r.sub_order_items!.filter((s) => s.description).map((sub) => (
                                        <p key={sub.id} className="text-xs text-muted-foreground pl-2 border-l-2 border-amber-300">
                                          {sub.description}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
