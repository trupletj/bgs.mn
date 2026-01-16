"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  User,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { UNIT_OPTIONS } from "@/types";
import { cn } from "@/lib/utils";

interface Reviewer {
  id: number;
  status: string;
  reviewed_at?: string;
  comments?: string;
  profile?: { name: string; position_name?: string };
  sub_order_items?: Array<{
    id: number;
    order_item_id: number;
    quantity: number;
    description?: string;
  }>;
  order_steps?: { step_name: string; step_order: number };
}

interface OrderWorkflowProps {
  reviewers: Reviewer[];
  items: any[];
}

export function OrderWorkflow({ reviewers, items }: OrderWorkflowProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const sorted = [...reviewers].sort((a, b) =>
    a.order_steps?.step_order && b.order_steps?.step_order
      ? a.order_steps.step_order - b.order_steps.step_order
      : 0
  );

  const getIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "changes_requested":
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-700 bg-green-50 border-green-200";
      case "rejected":
        return "text-red-700 bg-red-50 border-red-200";
      case "changes_requested":
        return "text-amber-700 bg-amber-50 border-amber-200";
      default:
        return "text-blue-700 bg-blue-50 border-blue-200";
    }
  };

  const getBadge = (status: string) => {
    const map: Record<string, { label: string; variant: any }> = {
      approved: { label: "Зөвшөөрсөн", variant: "default" },
      rejected: { label: "Татгалзсан", variant: "destructive" },
      changes_requested: { label: "Өөрчлөлт хүссэн", variant: "secondary" },
      skipped: { label: "Алгассан", variant: "outline" },
      default: { label: "Хүлээгдэж байна", variant: "outline" },
    };
    const s = map[status] || map.default;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  function formatDate(dateString: string) {
    if (!dateString) return "Оноогдоогүй";
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const getUnitLabel = (unit: string) => {
    const unitOption = UNIT_OPTIONS.find((option) => option.value === unit);
    return unitOption ? unitOption.label : unit;
  };

  const toggleExpanded = (id: number) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">
          Баталгаажуулалтын явц
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Явцын түүх байхгүй</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((r, i) => {
              const stepName =
                r.order_steps?.step_name ||
                `Алхам ${r.order_steps?.step_order || i + 1}`;
              const hasChanges =
                r.sub_order_items && r.sub_order_items.length > 0;
              const isExpanded = expanded.has(r.id);
              // const hasComments = r.comments?.trim().length > 0;

              return (
                <div
                  key={r.id}
                  className={cn(
                    "border rounded-lg transition-all duration-200",
                    isExpanded
                      ? "ring-2 ring-primary/10"
                      : "hover:border-primary/50",
                    getStatusColor(r.status || "pending")
                  )}>
                  <div
                    className={cn(
                      "flex items-start gap-3 p-4 cursor-pointer",
                      hasChanges && "pb-3"
                    )}
                    onClick={() => toggleExpanded(r.id)}>
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(r.status || "pending")}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-medium text-sm">{stepName}</h3>
                        <div className="flex items-center gap-2">
                          {getBadge(r.status || "pending")}
                          {hasChanges && (
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                                isExpanded && "rotate-180"
                              )}
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs  mb-2">
                        <User className="h-3.5 w-3.5" />
                        <span>{r.profile?.name || "Нэр байхгүй"}</span>
                        {r.profile?.position_name && (
                          <>
                            <span className="text-muted-foreground/50">•</span>
                            <span>{r.profile.position_name}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="">Оноосон:</span>
                          <span className="font-medium">
                            {formatDate(r.reviewed_at || "")}
                          </span>
                        </div>
                        {r.reviewed_at && (
                          <>
                            <div className="w-px h-3 bg-border" />
                            <div className="flex items-center gap-1">
                              <span className="">Шалгасан:</span>
                              <span className="font-medium">
                                {formatDate(r.reviewed_at)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && hasChanges && (
                    <div className="px-4 pb-4 pt-0 space-y-4">
                      {hasChanges && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs font-medium px-2">
                              Өөрчлөлтүүд
                            </span>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                          <div className="space-y-2">
                            {r.sub_order_items?.map((sub) => {
                              const orig = items.find(
                                (it) => it.id === sub.order_item_id
                              );
                              return (
                                <div
                                  key={sub.id}
                                  className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded border border-yellow-300 dark:border-yellow-800/30">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="font-medium text-sm">
                                      {orig?.part_name}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground">
                                        {orig?.quantity}{" "}
                                        {getUnitLabel(orig?.unit || "")}
                                      </span>
                                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="font-semibold text-amber-700">
                                        {sub.quantity}{" "}
                                        {getUnitLabel(orig?.unit || "")}
                                      </span>
                                    </div>
                                  </div>
                                  {sub.description && (
                                    <p className="text-xs text-muted-foreground mt-1 pl-1 border-l-2 border-amber-300 dark:border-amber-700">
                                      {sub.description}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
