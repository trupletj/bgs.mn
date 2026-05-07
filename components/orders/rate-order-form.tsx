"use client";

import { useState, useEffect, useCallback } from "react";
import { RateItemForm } from "@/components/orders/rate-item-form";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { OrderDetails, OrderItem, OrderStep } from "@/types/rate";
import { cn } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  UserRound,
} from "lucide-react";

interface RateOrderFormProps {
  order_instance_id: string;
  profile_id: string;
}

interface WorkflowStep {
  id: number;
  step_order: number;
  step_name: string;
}

interface StepReviewer {
  id: number;
  status: string;
  reviewed_at?: string | null;
  comment?: string | null;
  order_steps?:
    | {
        step_order: number;
      }
    | null
    | Array<{ step_order: number }>;
  profile?:
    | {
        name?: string | null;
        department_name?: string | null;
        position_name?: string | null;
      }
    | null
    | Array<{
        name?: string | null;
        department_name?: string | null;
        position_name?: string | null;
      }>;
}

type ReviewerProfile =
  | {
      name?: string | null;
      department_name?: string | null;
      position_name?: string | null;
    }
  | null
  | undefined;

type StepState = "completed" | "current" | "next" | "pending";

interface WorkflowStepCardProps {
  step: WorkflowStep;
  stepState: StepState;
  reviewers: StepReviewer[];
}

interface WorkflowProgressStripProps {
  steps: WorkflowStep[];
  getStepState: (step: WorkflowStep) => StepState;
}

function WorkflowProgressStrip({
  steps,
  getStepState,
}: WorkflowProgressStripProps) {
  const getStateLabel = (state: StepState) => {
    switch (state) {
      case "completed":
        return "Шалгасан";
      case "current":
        return "Одоо шалгаж байна";
      case "next":
        return "Дараагийн шат";
      default:
        return "Хүлээгдэж байна";
    }
  };

  return (
    <div className="mb-6 hidden xl:block">
      <div
        className="relative grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}>
        {steps.map((step, index) => {
          const stepState = getStepState(step);
          const isCompleted = stepState === "completed";
          const isCurrent = stepState === "current";
          const isUpcoming = stepState === "next" || stepState === "pending";

          return (
            <div
              key={step.id}
              className="relative flex flex-col items-center text-center">
              {/* line to next step */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute left-1/2 top-5 ml-5 h-0.5 w-[calc(100%-2.5rem)]",
                    isCompleted
                      ? "bg-emerald-500"
                      : isCurrent
                        ? "bg-primary/30"
                        : "bg-slate-200",
                  )}
                />
              )}

              {/* step circle */}
              <div
                className={cn(
                  "relative z-10 flex size-10 items-center justify-center rounded-full border-2 bg-white text-sm font-semibold shadow-sm transition-colors",
                  isCompleted && "border-emerald-500 bg-emerald-500 text-white",
                  isCurrent &&
                    "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                  isUpcoming && "border-slate-300 text-slate-500",
                )}>
                {isCompleted ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  step.step_order
                )}
              </div>

              {/* step name */}
              <p
                className={cn(
                  "mt-3 max-w-[160px] text-sm font-semibold",
                  isCurrent ? "text-slate-950" : "text-slate-700",
                )}></p>

              {/* step state label */}
              <p
                className={cn(
                  "mt-1 text-xs",
                  isCompleted && "text-emerald-700",
                  isCurrent && "text-primary",
                  isUpcoming && "text-muted-foreground",
                )}>
                {getStateLabel(stepState)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDisplayDate(dateString?: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getReviewStatusLabelValue(status: string) {
  const labels: Record<string, string> = {
    approved: "Зөвшөөрсөн",
    rejected: "Татгалзсан",
    changes_requested: "Өөрчлөлт хүссэн",
    skipped: "Алгассан",
  };

  return labels[status] || status;
}

function getReviewerProfileValue(reviewer: StepReviewer): ReviewerProfile {
  return Array.isArray(reviewer.profile)
    ? reviewer.profile[0]
    : reviewer.profile;
}

function WorkflowStepCard({
  step,
  stepState,
  reviewers,
}: WorkflowStepCardProps) {
  const stateLabel: Record<StepState, string> = {
    completed: "Шалгасан",
    current: "Одоо шалгаж байна",
    next: "Дараагийн шат",
    pending: "Хүлээгдэж байна",
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-white p-4 shadow-xs",
        stepState === "current" &&
          "border-primary/40 bg-primary/[0.04] shadow-sm ring-1 ring-primary/15",
        stepState === "completed" && "border-emerald-200/80",
      )}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
            stepState === "completed" &&
              "border-emerald-200 bg-emerald-50 text-emerald-700",
            stepState === "current" &&
              "border-primary bg-primary text-primary-foreground",
            (stepState === "next" || stepState === "pending") &&
              "border-slate-200 bg-slate-50 text-slate-500",
          )}>
          {stepState === "completed" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            step.step_order
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className=" font-semibold">{step.step_name}</p>
            <StatusBadge status={stepState} label={stateLabel[stepState]} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {step.step_order}-р алхам
          </p>
        </div>
      </div>

      <Separator className="my-3" />

      {stepState === "completed" ? (
        <div className="flex flex-col gap-2">
          {reviewers.length > 0 ? (
            reviewers.map((reviewer) => {
              const reviewerProfile = getReviewerProfileValue(reviewer);

              return (
                <div
                  key={reviewer.id}
                  className="rounded-xl border bg-slate-50/80 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {reviewerProfile?.name || "Нэр тодорхойгүй"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {reviewerProfile?.position_name ||
                          "Ажлын байр тодорхойгүй"}
                      </p>
                    </div>
                    <StatusBadge
                      status={reviewer.status}
                      label={getReviewStatusLabelValue(reviewer.status)}
                    />
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    {reviewer.reviewed_at && (
                      <span className="shrink-0">
                        {formatDisplayDate(reviewer.reviewed_at)}
                      </span>
                    )}
                    {reviewer.comment && (
                      <span className="truncate">{reviewer.comment}</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              Үнэлсэн хүний мэдээлэл олдсонгүй.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
          {stepState === "current"
            ? "Таны үнэлгээ хүлээгдэж байна."
            : "Энэ шат дараа нээгдэнэ."}
        </div>
      )}
    </div>
  );
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Хүлээгдэж байна",
  in_progress: "Явагдаж байна",
  approved: "Зөвшөөрсөн",
  rejected: "Татгалзсан",
  completed: "Дууссан",
  changes_requested: "Өөрчлөлт хүссэн",
};

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const className =
    status === "approved" || status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "rejected"
        ? "border-red-200 bg-red-50 text-red-700"
        : status === "changes_requested"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : status === "pending"
            ? "border-slate-200 bg-slate-50 text-slate-600"
            : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <Badge variant="outline" className={className}>
      {label || ORDER_STATUS_LABELS[status] || status}
    </Badge>
  );
}

export default function RateOrderForm({
  order_instance_id,
  profile_id,
}: RateOrderFormProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [currentStep, setCurrentStep] = useState<OrderStep | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [stepReviewers, setStepReviewers] = useState<StepReviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchOrderDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("order_instance_id", order_instance_id);
      console.log("reviewer_profile_id", profile_id);

      const { data: reviewer, error: reviewerError } = await supabase
        .from("order_step_reviewers")
        .select(
          `
          order_step_id,
          status,
          order_steps(
            id,
            step_order,
            step_name,
            required_approval_count
          )
        `,
        )
        .eq("order_instance_id", order_instance_id)
        .eq("reviewer_profile_id", profile_id)
        .eq("status", "pending")
        .single();

      if (reviewerError || !reviewer) {
        console.error("Reviewer error:", reviewerError);
        setError(
          "Таны шалгах эрхтэй захиалга олдсонгүй эсвэл аль хэдийн шалгагдсан байна.",
        );
        return;
      }

      if (reviewer.order_steps) {
        setCurrentStep(reviewer.order_steps as unknown as OrderStep);
      }

      const { data: instance, error: instanceError } = await supabase
        .from("order_instances")
        .select(
          `
          id,
          status,
          current_step_order,
          order_process_id,
          orders:orders!inner (
            id,
            order_number,
            title,
            description,
            status,
            urgency_level,
            requested_delivery_date,
            created_at,
            order_type,
            created_profile,
            profile:profile!inner (
              name,
              department_name
            )
          )
        `,
        )
        .eq("id", order_instance_id)
        .single();

      if (instanceError || !instance?.orders) {
        throw new Error("Захиалгын мэдээлэл авахад алдаа гарлаа");
      }
      console.log("instances:", instance);

      const { data: steps, error: stepsError } = await supabase
        .from("order_steps")
        .select("id, step_order, step_name")
        .eq("order_process_id", instance.order_process_id)
        .order("step_order", { ascending: true });

      if (stepsError) throw stepsError;
      setWorkflowSteps(steps || []);

      const { data: reviewers, error: reviewersError } = await supabase
        .from("order_step_reviewers")
        .select(
          `
          id,
          status,
          reviewed_at,
          comment,
          order_steps (
            step_order
          ),
          profile:reviewer_profile_id (
            name,
            department_name,
            position_name
          )
        `,
        )
        .eq("order_instance_id", order_instance_id)
        .neq("status", "pending")
        .neq("status", "skipped")
        .order("reviewed_at", { ascending: true });

      if (reviewersError) throw reviewersError;
      setStepReviewers((reviewers || []) as unknown as StepReviewer[]);

      const orderData = Array.isArray(instance.orders)
        ? instance.orders[0]
        : instance.orders;
      console.log("orderData:", orderData);
      const profileData = Array.isArray(orderData.profile)
        ? orderData.profile[0]
        : orderData.profile;
      console.log("profileData:", profileData);

      setOrder({
        id: orderData.id,
        order_number: orderData.order_number,
        title: orderData.title,
        description: orderData.description,
        status: orderData.status,
        urgency_level: orderData.urgency_level,
        requested_delivery_date: orderData.requested_delivery_date,
        created_at: orderData.created_at,
        order_type: orderData.order_type,
        profile: profileData,
        created_profile: orderData.created_profile,
      });

      // 3. Order items авах
      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select(
          `
          id,
          order_id,
          part_name,
          part_number,
          quantity,
          unit,
          spare_type,
          image_url,
          notes,
          status,
          part_description
        `,
        )
        .eq("order_id", orderData.id);

      if (itemsError) throw itemsError;

      setOrderItems(items || []);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
      toast.error("Мэдээлэл татахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, [order_instance_id, profile_id, supabase]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  const getOrderTypeBadge = (orderType: string) => {
    const types: Record<string, { label: string; className: string }> = {
      emergency: {
        label: "Яаралтай",
        className: "bg-red-100 text-red-800 text-sm",
      },
      service: {
        label: "Үйлчилгээний",
        className: "bg-yellow-100 text-yellow-800 text-sm",
      },
      "major repairs": {
        label: "Их засвар",
        className: "bg-orange-100 text-orange-800 text-sm",
      },
      "safety reserves": {
        label: "Аюулгүйн нөөц",
        className: "bg-green-100 text-green-800 text-sm",
      },
      other: { label: "Бусад", className: "bg-blue-100 text-blue-800 text-sm" },
    };

    const config = types[orderType] || types.other;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getStepState = (step: WorkflowStep) => {
    if (!currentStep) return "pending";
    if (step.step_order < currentStep.step_order) return "completed";
    if (step.step_order === currentStep.step_order) return "current";
    if (step.step_order === currentStep.step_order + 1) return "next";
    return "pending";
  };

  const getReviewersByStep = (stepOrder: number) =>
    stepReviewers.filter(
      (reviewer) => getReviewerStepOrder(reviewer) === stepOrder,
    );

  const getReviewerStepOrder = (reviewer: StepReviewer) => {
    const step = Array.isArray(reviewer.order_steps)
      ? reviewer.order_steps[0]
      : reviewer.order_steps;

    return step?.step_order;
  };

  const correctionName = (name: string | null | undefined) => {
    return name?.split("/")[0].trim() || "Тодорхойгүй";
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order || !currentStep) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center space-y-4">
          <p className="text-red-500 text-lg">
            {error || "Захиалга олдсонгүй"}
          </p>
          <button
            onClick={fetchOrderDetails}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Дахин ачаалах
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 px-4 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
          <div className="border-b bg-white px-6 py-2.5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  Захиалгын төрөл: {getOrderTypeBadge(order.order_type)}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                  {order.title}
                </h1>
                {order.description && (
                  <p className="mt-2 max-w-4xl   ">{order.description}</p>
                )}
              </div>

              <div className="rounded-xl border bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Одоогийн шат
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <ClipboardCheck className="size-4 text-primary" />
                  <p className="font-semibold">
                    {currentStep.step_order}-р алхам: {currentStep.step_name}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <CardContent className="grid gap-4 px-6 py-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-700">
                <UserRound className="size-4" />
                Хүсэлт гаргагч
              </div>
              <p className="mt-2 font-semibold">
                {correctionName(order.profile?.name) || "Тодорхойгүй"}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm ">
                <Building2 className="size-3.5" />
                {order.profile?.department_name || "Хэлтэс тодорхойгүй"}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-700">
                <CalendarDays className="size-4" />
                Хэрэгцээт огноо
              </div>
              <p className="mt-2 font-semibold">
                {formatDate(order.requested_delivery_date) || "-"}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-700 ">
                <Clock3 className="size-4" />
                Үүссэн огноо
              </div>
              <p className="mt-2 font-semibold">
                {formatDate(order.created_at)}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-700">
                <FileText className="size-4" />
                Нийт сэлбэг
              </div>
              <p className="mt-2 text-2xl font-semibold">{orderItems.length}</p>
            </div>
          </CardContent>
        </Card>

        {workflowSteps.length > 0 && (
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Шалгалтын явц</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Өмнөх үнэлгээ болон одоогийн шат нэг дор харагдана.
                  </p>
                </div>
                <Badge variant="secondary">{workflowSteps.length} шат</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <WorkflowProgressStrip
                steps={workflowSteps}
                getStepState={getStepState}
              />

              <div
                className="hidden gap-3 xl:grid"
                style={{
                  gridTemplateColumns: `repeat(${workflowSteps.length}, minmax(0, 1fr))`,
                }}>
                {workflowSteps.map((step) => {
                  const reviewers = getReviewersByStep(step.step_order);
                  const stepState = getStepState(step);

                  return (
                    <WorkflowStepCard
                      key={step.id}
                      step={step}
                      stepState={stepState}
                      reviewers={reviewers}
                    />
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 xl:hidden">
                {workflowSteps.map((step) => {
                  const reviewers = getReviewersByStep(step.step_order);

                  return (
                    <WorkflowStepCard
                      key={step.id}
                      step={step}
                      stepState={getStepState(step)}
                      reviewers={reviewers}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <RateItemForm
          orderItems={orderItems}
          currentStep={currentStep}
          order_instance_id={parseInt(order_instance_id)}
          reviewer_profile_id={parseInt(profile_id)}
        />
      </div>
    </div>
  );
}
