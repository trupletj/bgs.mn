"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type StepType, getPreviousStep } from "@/utils/workflow";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Calendar,
  Briefcase,
  Building2,
  Package,
  ArrowRight,
  MessageSquare,
  Edit3,
} from "lucide-react";

interface PreviousReviewersActionsProps {
  orderId: string;
  currentStep: StepType;
}

interface Profile {
  name: string;
  position_name: string;
  department_name: string;
}

interface ReviewerAction {
  id: number;
  reviewer_type: StepType;
  status: string;
  comments: string;
  completed_at: string;
  profile: Profile;
}

interface OrderItem {
  id: number;
  part_name: string;
  part_number: string;
  quantity: number;
}

interface SubOrderItem {
  id: number;
  quantity: number;
  description: string;
  created_at: string;
  created_by: string;
  order_item_id: number;

  order_item:
    | { part_name?: string; part_number?: string }
    | { part_name?: string; part_number?: string }[];
  profile: { name?: string } | { name?: string }[];
}

interface ItemChange {
  id: number;
  part_name: string;
  part_number: string;
  old_quantity: number;
  new_quantity: number;
  changed_at: string;
  description: string;
  reviewer_name: string;
  order_item_id: number;
}

interface ReviewerWithActions {
  reviewer: ReviewerAction;
  itemChanges: ItemChange[];
}

export function PreviousReviewersActions({
  orderId,
  currentStep,
}: PreviousReviewersActionsProps) {
  const [reviewerActions, setReviewerActions] = useState<ReviewerAction[]>([]);
  const [itemChanges, setItemChanges] = useState<ItemChange[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPreviousReviewersActions = useCallback(async () => {
    try {
      const supabase = createClient();
      const previousStep = getPreviousStep(currentStep);

      if (!previousStep || previousStep === "created_step") {
        setLoading(false);
        return;
      }

      // Fetch reviewers data
      const { data: reviewersData, error: reviewersError } = await supabase
        .from("order_reviewers")
        .select(
          `
          id,
          reviewer_type,
          status,
          comments,
          completed_at,
          profile:profile_id (
            name,
            position_name,
            department_name
          )
        `
        )
        .eq("order_id", orderId)
        .eq("reviewer_type", previousStep)
        .neq("status", "pending")
        .order("completed_at", { ascending: false });

      if (reviewersError) throw reviewersError;

      const reviewerIds = (reviewersData || []).map((rev) => rev.id);

      // Fetch sub order items
      const { data: subOrderItemsData, error: subOrderItemsError } =
        await supabase
          .from("sub_order_item")
          .select(
            `
          id,
          quantity,
          description,
          created_at,
          created_by,
          order_item_id,
          order_item:order_item_id (
            part_name,
            part_number
          ),
          profile:created_by (
            name
          )
        `
          )
          .eq("order_id", orderId)
          .in("order_reviewer_id", reviewerIds)
          .order("created_at", { ascending: false });

      if (subOrderItemsError) throw subOrderItemsError;

      // Fetch original order items
      const { data: originalOrderItems, error: originalItemsError } =
        await supabase
          .from("order_items")
          .select("id, quantity")
          .eq("order_id", orderId);

      if (originalItemsError) throw originalItemsError;

      // Process reviewers data
      const processedReviewers: ReviewerAction[] = (reviewersData || []).map(
        (item) => ({
          ...item,
          profile: Array.isArray(item.profile) ? item.profile[0] : item.profile,
        })
      );

      // Process item changes
      const processedChanges: ItemChange[] = [];
      (subOrderItemsData || []).forEach((subItem: SubOrderItem) => {
        const originalItem = originalOrderItems?.find(
          (item) => item.id === subItem.order_item_id
        );

        if (originalItem) {
          const partInfo = Array.isArray(subItem.order_item)
            ? subItem.order_item[0]
            : subItem.order_item;

          const reviewerInfo = Array.isArray(subItem.profile)
            ? subItem.profile[0]
            : subItem.profile;

          processedChanges.push({
            id: subItem.id,
            part_name: partInfo?.part_name || "Тодорхойгүй",
            part_number: partInfo?.part_number || "",
            old_quantity: originalItem.quantity,
            new_quantity: subItem.quantity,
            changed_at: subItem.created_at,
            description: subItem.description || "",
            reviewer_name: reviewerInfo?.name || "Тодорхойгүй",
            order_item_id: subItem.order_item_id,
          });
        }
      });

      setReviewerActions(processedReviewers);
      setItemChanges(processedChanges);
    } catch (error) {
      console.error("Өмнөх шалгагчдын мэдээлэл авахад алдаа:", error);
    } finally {
      setLoading(false);
    }
  }, [orderId, currentStep]);

  useEffect(() => {
    fetchPreviousReviewersActions();
  }, [fetchPreviousReviewersActions]);

  const getStepLabel = (step: StepType) => {
    const stepLabels: Record<StepType, string> = {
      created_step: "Үүсгэсэн",
      first_step: "1-р шат",
      second_step: "2-р шат",
      third_step: "3-р шат",
      fourth_step: "4-р шат",
    };
    return stepLabels[step] || step;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: {
        label: "Зөвшөөрсөн",
        variant: "default" as const,
        icon: CheckCircle2,
        className:
          "bg-green-100 text-green-800 hover:bg-green-100 border-green-200",
      },
      changes_requested: {
        label: "Өөрчлөлт санал болгосон",
        variant: "secondary" as const,
        icon: AlertCircle,
        className:
          "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200",
      },
      rejected: {
        label: "Татгалзсан",
        variant: "destructive" as const,
        icon: XCircle,
        className: "bg-red-100 text-red-800 hover:bg-red-100 border-red-200",
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge
        variant={config.variant}
        className={`${config.className} flex items-center gap-1.5 px-3 py-1`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </Badge>
    );
  };

  const groupActionsByReviewer = (): ReviewerWithActions[] => {
    return reviewerActions.map((reviewer) => {
      const reviewerItemChanges = itemChanges.filter(
        (change) => change.reviewer_name === reviewer.profile.name
      );
      return {
        reviewer,
        itemChanges: reviewerItemChanges,
      };
    });
  };

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Өмнөх шатны үйлдлүүд</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const previousStep = getPreviousStep(currentStep);
  if (!previousStep || previousStep === "created_step") {
    return null;
  }

  const reviewersWithActions = groupActionsByReviewer();

  return (
    <Card className="shadow-sm border-border/50 mt-3">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100/50">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-sm">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-900">Өмнөх шатны үйлдлүүд</span>
              <Badge variant="outline" className="font-normal bg-white">
                {getStepLabel(previousStep)}
              </Badge>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {reviewersWithActions.length > 0 ? (
          <div className="space-y-6">
            {reviewersWithActions.map(
              ({ reviewer, itemChanges: reviewerItemChanges }) => (
                <div
                  key={reviewer.id}
                  className="relative border-2 border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200">
                  {/* Reviewer Header Section */}
                  <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b-2 border-slate-200 p-5">
                    <div className="flex items-start gap-4">
                      {/* Reviewer Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-bold text-xl text-slate-900">
                            {reviewer.profile.name}
                          </h3>
                          {getStatusBadge(reviewer.status)}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2 text-slate-600">
                            <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                              <Briefcase className="w-3.5 h-3.5 text-slate-600" />
                            </div>
                            <span className="font-medium">
                              {reviewer.profile.position_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                              <Building2 className="w-3.5 h-3.5 text-slate-600" />
                            </div>
                            <span className="font-medium">
                              {reviewer.profile.department_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 sm:col-span-2">
                            <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                              <Calendar className="w-3.5 h-3.5 text-slate-600" />
                            </div>
                            <span className="font-medium">
                              {new Date(
                                reviewer.completed_at
                              ).toLocaleDateString("mn-MN", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Content Section */}
                  <div className="p-5 space-y-4 bg-white">
                    {/* Reviewer Comments */}
                    {reviewer.comments && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <MessageSquare className="w-4 h-4 text-indigo-600" />
                          <span>Тайлбар</span>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-l-4 border-indigo-500 rounded-r-lg p-4 shadow-sm">
                          <p className="text-slate-800 leading-relaxed">
                            {reviewer.comments}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Item Changes by This Reviewer */}
                    {reviewerItemChanges.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <Edit3 className="w-4 h-4 text-emerald-600" />
                          <span>Хийсэн өөрчлөлтүүд</span>
                          <Badge variant="secondary" className="ml-auto">
                            {reviewerItemChanges.length} зүйл
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          {reviewerItemChanges.map((change) => (
                            <div
                              key={change.id}
                              className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4 shadow-sm">
                              <div className="flex items-center gap-4">
                                {/* Icon */}
                                <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                                  <Package className="w-5 h-5 text-white" />
                                </div>

                                {/* Part info + quantities */}
                                <div className="flex-1 flex flex-wrap items-center justify-between gap-4">
                                  {/* Name + Code */}
                                  <div>
                                    <h4 className="font-semibold text-slate-900">
                                      {change.part_name}
                                    </h4>
                                    {change.part_number && (
                                      <p className="text-sm text-slate-600">
                                        Код:{" "}
                                        <span className="font-mono font-semibold">
                                          {change.part_number}
                                        </span>
                                      </p>
                                    )}
                                  </div>

                                  {/* Quantity change */}
                                  <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-center">
                                      <span className="text-xs text-slate-500 uppercase">
                                        Хуучин
                                      </span>
                                      <div className="px-3 py-1 bg-red-100 border border-red-300 rounded-md">
                                        <span className="text-lg font-bold text-red-700 line-through">
                                          {change.old_quantity}
                                        </span>
                                      </div>
                                    </div>

                                    <ArrowRight className="w-5 h-5 text-slate-400" />

                                    <div className="flex flex-col items-center">
                                      <span className="text-xs text-slate-500 uppercase">
                                        Шинэ
                                      </span>
                                      <div className="px-3 py-1 bg-emerald-100 border border-emerald-400 rounded-md">
                                        <span className="text-lg font-bold text-emerald-700">
                                          {change.new_quantity}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Description (optional) */}
                              {change.description && (
                                <div className="bg-white border border-slate-200 rounded-lg p-3 mt-3">
                                  <p className="text-xs font-semibold text-slate-500 mb-1 uppercase">
                                    Тайлбар:
                                  </p>
                                  <p className="text-sm text-slate-700 leading-relaxed">
                                    {change.description}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No changes indicator */}
                    {!reviewer.comments && reviewerItemChanges.length === 0 && (
                      <div className="text-center py-6 text-slate-500">
                        <p className="text-sm">
                          Нэмэлт тайлбар болон өөрчлөлт байхгүй
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">
              Өмнөх шатнаас үйлдэл байхгүй байна
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Шалгагчдын шийдвэр болон өөрчлөлтүүд энд харагдана
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
