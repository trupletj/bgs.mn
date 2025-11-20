"use client";

import {
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  User,
  MessageSquare,
  TrendingUp,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderReviewers, OrderItem } from "@/actions/orders";
import { useState } from "react";
import { UNIT_OPTIONS } from "@/types/types";

interface OrderWorkflowTimelineProps {
  reviewers: OrderReviewers[];
  items: OrderItem[];
}

export function OrderWorkflowTimeline({
  reviewers,
  items,
}: OrderWorkflowTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const sortedReviewers = [...reviewers].sort(
    (a, b) =>
      new Date(a.assigned_at).getTime() - new Date(b.assigned_at).getTime()
  );

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return (
          <CheckCircle className="h-6 w-6 text-emerald-500 flex-shrink-0" />
        );
      case "rejected":
        return <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />;
      case "changes_requested":
        return <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0" />;
      case "pending":
        return <Clock className="h-6 w-6 text-blue-500 flex-shrink-0" />;
      default:
        return <Clock className="h-6 w-6 text-slate-400 flex-shrink-0" />;
    }
  };

  const getStatusBadgeVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      case "changes_requested":
        return "secondary";
      case "pending":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      approved: "Баталсан",
      changes_requested: "Өөрчлөлт хүсэлтэй",
      rejected: "Татгалзсан",
      pending: "Хүлээгдэж байгаа",
    };
    return (
      labels[status.toLowerCase()] || status.replace("_", " ").toUpperCase()
    );
  };

  const getStepLabel = (reviewerType: string): string => {
    switch (reviewerType.toLowerCase()) {
      case "first_step":
        return "1-р шат - Эхний баталгаажуулалт";
      case "second_step":
        return "2-р шат - Хоёр дахь баталгаажуулалт";
      case "third_step":
        return "3-р шат - Гурав дахь баталгаажуулалт";
      case "fourth_step":
        return "4-р шат - Дөрөв дэх баталгаажуулалт";
      default:
        return reviewerType;
    }
  };

  function formatDateCustom(dateString: string) {
    const date = new Date(dateString);

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year} оны ${month} сарын ${day} өдөр`;
  }

  const getReviewerStatus = (reviewer: OrderReviewers): string => {
    if (!reviewer.is_reviewed) {
      return "pending";
    }
    return reviewer.status || "pending";
  };

  const getItemDetails = (itemId: number) => {
    return items.find((item) => item.id === itemId);
  };

  const getUnitLabel = (unit: string) => {
    return UNIT_OPTIONS.find((u) => u.value === unit)?.label || unit;
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="border-b border-slate-200 dark:border-slate-800">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-950 rounded-lg">
            <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <span>Захиалгын баталгаажуулалтын явц</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {sortedReviewers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-600 dark:text-slate-400">
              Захиалгын баталгаажуулалтын түүх байхгүй.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedReviewers.map((reviewer, index) => {
              const status = getReviewerStatus(reviewer);
              const isCompleted = reviewer.completed_at;
              const isExpanded = expandedId === reviewer.id;
              const hasChanges =
                reviewer.sub_order_item && reviewer.sub_order_item.length > 0;

              return (
                <div key={reviewer.id}>
                  {/* Timeline connector line */}
                  {index > 0 && (
                    <div className="flex items-start mb-4">
                      <div className="w-6 flex justify-center relative">
                        <div className="w-0.5 h-4 bg-gradient-to-b from-slate-300 to-slate-200 dark:from-slate-700 dark:to-slate-800" />
                      </div>
                    </div>
                  )}

                  {/* Timeline item */}
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : reviewer.id)
                    }
                    className="w-full text-left hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800 transition-all">
                    <div className="flex gap-4 items-start">
                      {/* Status Icon */}
                      <div className="flex-shrink-0 flex items-start pt-1 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                        {getStatusIcon(status)}
                      </div>

                      {/* Main Content */}
                      <div className="flex-grow min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {getStepLabel(reviewer.reviewer_type)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={getStatusBadgeVariant(status)}
                              className="w-fit">
                              {getStatusLabel(status)}
                            </Badge>
                            {hasChanges && (
                              <Badge variant="secondary" className="w-fit">
                                {reviewer.sub_order_item?.length} өөрчлөлт
                              </Badge>
                            )}
                            <ChevronDown
                              className={`h-4 w-4 text-slate-500 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </div>

                        {/* Reviewer info - always visible */}
                        <div className="flex items-center gap-2 mb-2 text-sm">
                          <User className="h-4 w-4 text-slate-500 flex-shrink-0" />
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {reviewer.profile?.name || "Үл мэдэгдэх"}
                          </span>
                          {reviewer.profile?.position_name && (
                            <span className="text-slate-600 dark:text-slate-400">
                              ({reviewer.profile.position_name})
                            </span>
                          )}
                        </div>

                        {/* Dates - always visible */}
                        <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
                          {reviewer.assigned_at && (
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                Оноосон:
                              </span>{" "}
                              {formatDateCustom(reviewer.assigned_at)}
                            </div>
                          )}
                          {isCompleted && (
                            <div>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                Дуусгасан:
                              </span>{" "}
                              {formatDateCustom(isCompleted)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                        {hasChanges && (
                          <div>
                            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                              Өөрчлөлт хүсэлтэй эд ангиуд
                            </h5>
                            <div className="space-y-3">
                              {reviewer.sub_order_item?.map((subItem) => {
                                const originalItem = getItemDetails(
                                  subItem.order_item_id
                                );
                                return (
                                  <div
                                    key={subItem.id}
                                    className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg space-y-2">
                                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                      {originalItem?.part_name ||
                                        "Үл мэдэгдэх эд анги"}
                                    </p>
                                    {originalItem?.part_number && (
                                      <p className="text-xs text-amber-800 dark:text-amber-200">
                                        Дугаар: {originalItem.part_number}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-amber-200 dark:border-amber-900/50">
                                      <div className="flex-1">
                                        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mb-1">
                                          Анхны тоо:
                                        </p>
                                        <div className="inline-block px-2 py-1 bg-white dark:bg-amber-900 rounded text-xs font-semibold text-amber-900 dark:text-amber-100">
                                          {originalItem?.quantity}{" "}
                                          {getUnitLabel(
                                            originalItem?.unit || ""
                                          )}
                                        </div>
                                      </div>

                                      <ArrowRight className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />

                                      <div className="flex-1">
                                        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mb-1">
                                          Өөрчлөгдсөн тоо:
                                        </p>
                                        <div className="inline-block px-2 py-1 bg-white dark:bg-amber-900 rounded text-xs font-semibold text-amber-900 dark:text-amber-100">
                                          {subItem.quantity}{" "}
                                          {getUnitLabel(
                                            originalItem?.unit || ""
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {subItem.description && (
                                      <p className="text-xs text-amber-800 dark:text-amber-200 mt-2 italic">
                                        Тайлбар: {subItem.description}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Comments */}
                        {reviewer.comments && (
                          <div>
                            <div className="flex gap-2 mb-2">
                              <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                              <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                                Сэтгэгдэл
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 ml-6 p-3 bg-blue-50 dark:bg-blue-950/20 border-l-3 border-blue-500 rounded leading-relaxed">
                              {reviewer.comments}
                            </p>
                          </div>
                        )}

                        {/* Empty state */}
                        {!hasChanges && !reviewer.comments && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                            Ямар ч өөрчлөлт эсвэл сэтгэгдэл байхгүй.
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
