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
  const [expanded, setExpanded] = useState<number | null>(null);

  const sorted = [...reviewers].sort((a, b) =>
    a.order_steps?.step_order && b.order_steps?.step_order
      ? a.order_steps.step_order - b.order_steps.step_order
      : 0
  );

  const getIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case "rejected":
        return <XCircle className="h-6 w-6 text-red-600" />;
      case "changes_requested":
        return <AlertCircle className="h-6 w-6 text-yellow-600" />;
      default:
        return <Clock className="h-6 w-6 text-blue-600" />;
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
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padEnd(2, "0");
    const day = String(date.getDate()).padEnd(2, "0");

    return `${year} он ${month} сар ${day} өдөр`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Баталгаажуулалтын явц</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Явцын түүх байхгүй
          </p>
        ) : (
          <div className="space-y-4">
            {sorted.map((r, i) => {
              const stepName =
                r.order_steps?.step_name ||
                `Алхам ${r.order_steps?.step_order || i + 1}`;
              const hasChanges =
                r.sub_order_items && r.sub_order_items.length > 0;
              const isExpanded = expanded === r.id;

              return (
                <div key={r.id}>
                  {i > 0 && (
                    <div className="ml-8 border-l-2 border-muted h-8" />
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start p-4 hover:bg-muted/50"
                    onClick={() => setExpanded(isExpanded ? null : r.id)}>
                    <div className="flex gap-4 w-full items-start">
                      {getIcon(r.status || "pending")}
                      <div className="flex-1 text-left">
                        <div className="font-medium">{stepName}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          <User className="inline h-4 w-4 mr-1" />
                          {r.profile?.name || "Нэр байхгүй"}
                          {r.profile?.position_name &&
                            ` (${r.profile.position_name})`}
                        </div>
                        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                          <span>
                            Оноосон: {formatDate(r.reviewed_at || "")}
                          </span>
                          {r.reviewed_at && (
                            <span>Шалгасан: {formatDate(r.reviewed_at)}</span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-2">
                          {getBadge(r.status || "pending")}
                          {hasChanges && (
                            <Badge variant="secondary">
                              {hasChanges} өөрчлөлт
                            </Badge>
                          )}
                          <ChevronDown
                            className={`ml-auto h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </Button>

                  {isExpanded && (
                    <div className="ml-12 mt-2 space-y-4 pb-4">
                      {hasChanges && (
                        <div>
                          <h4 className="font-medium mb-2">Өөрчлөлтүүд</h4>
                          {r.sub_order_items?.map((sub) => {
                            const orig = items.find(
                              (it) => it.id === sub.order_item_id
                            );
                            return (
                              <div
                                key={sub.id}
                                className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200">
                                <p className="font-medium">{orig?.part_name}</p>
                                <div className="flex items-center gap-4 mt-2">
                                  <span>
                                    {orig?.quantity} {orig?.unit}
                                  </span>
                                  <ArrowRight className="h-4 w-4" />
                                  <span className="font-semibold">
                                    {sub.quantity} {orig?.unit}
                                  </span>
                                </div>
                                {sub.description && (
                                  <p className="text-sm mt-1 italic">
                                    {sub.description}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {r.comments && (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4" />
                            <span className="font-medium">Тайлбар</span>
                          </div>
                          <p className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded">
                            {r.comments}
                          </p>
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
