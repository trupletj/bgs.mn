// components/review-requests-list.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

// Supabase-аас ирж буй өгөгдлийн төрөл
interface DatabaseProfile {
  name: string;
  department_name: string;
}

interface DatabaseOrder {
  id: number;
  order_number: string;
  title: string;
  description: string;
  status: string;
  urgency_level: string;
  created_at: string;
  profile: DatabaseProfile | DatabaseProfile[];
}

interface DatabaseReviewRequest {
  id: number;
  order_id: number;
  reviewer_type: string;
  assigned_at: string;
  status: string;
  is_reviewed: boolean;
  orders: DatabaseOrder | DatabaseOrder[];
}

// Боловсруулсан өгөгдлийн төрөл
interface ReviewRequest {
  id: number;
  order_id: number;
  orders: {
    id: number;
    order_number: string;
    description: string;
    title: string;
    status: string;
    urgency_level: string;
    created_at: string;
    profile: {
      name: string;
      department_name: string;
    };
  };
  reviewer_type: string;
  assigned_at: string;
  status: string;
  is_reviewed: boolean;
}

interface ReviewRequestProp {
  profile_id: string;
}

export function ReviewRequestsList({ profile_id }: ReviewRequestProp) {
  const [reviewRequests, setReviewRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchReviewRequests();
  }, [profile_id]); // profile_id-г dependency-д нэмэх

  const fetchReviewRequests = async () => {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("order_reviewers")
        .select(
          `
          id,
          order_id,
          reviewer_type,
          assigned_at,
          status,
          is_reviewed,
          orders:order_id (
            id,
            order_number,
            title,
            description,
            status,
            urgency_level,
            created_at,
            profile:created_profile (
              name,
              department_name
            )
          )
        `
        )
        .neq("status", "pending")
        .eq("profile_id", profile_id)
        .order("assigned_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      // any төрлийг DatabaseReviewRequest төрлөөр солих
      const processedData = (data || []).map((item: DatabaseReviewRequest) => {
        const ordersEntry = Array.isArray(item.orders)
          ? item.orders[0]
          : item.orders;

        let profileEntry: DatabaseProfile | undefined;
        if (ordersEntry) {
          if (Array.isArray(ordersEntry.profile)) {
            profileEntry = ordersEntry.profile[0];
          } else {
            profileEntry = ordersEntry.profile as DatabaseProfile | undefined;
          }
        }

        return {
          ...item,
          orders: {
            ...(ordersEntry || ({} as DatabaseOrder)),
            profile: profileEntry || { name: "", department_name: "" },
          },
        } as ReviewRequest;
      });

      setReviewRequests(processedData);
    } catch (error) {
      toast.error("Хүсэлтүүдийг авахад алдаа гарлаа");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Нэг захиалгыг нэг л удаа харуулах
  const uniqueOrders = reviewRequests.reduce((acc, request) => {
    const existingOrder = acc.find(
      (order) =>
        order.order_id === request.order_id &&
        order.reviewer_type === request.reviewer_type
    );
    if (!existingOrder) {
      acc.push(request);
    }
    return acc;
  }, [] as ReviewRequest[]);

  const handleReview = (orderId: number, reviewerType: string) => {
    // Шууд хандах - хуудас дээр эрх шалгана
    router.push(`/orders/${orderId}/review?step=${reviewerType}`);
  };

  const handleViewDetails = (orderId: number, reviewerType: string) => {
    router.push(`/orders/${orderId}/review-details?step=${reviewerType}`);
  };

  const getUrgencyBadge = (urgency: string) => {
    const urgencyConfig = {
      low: { label: "Бага", variant: "secondary" as const },
      medium: { label: "Дунд", variant: "outline" as const },
      high: { label: "Яаралтай", variant: "destructive" as const },
      critical: { label: "Нэн яаралтай", variant: "destructive" as const },
    };

    const config =
      urgencyConfig[urgency as keyof typeof urgencyConfig] ||
      urgencyConfig.medium;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStepBadge = (reviewerType: string) => {
    const stepConfig = {
      first_step: { label: "1-р шат", variant: "default" as const },
      second_step: { label: "2-р шат", variant: "secondary" as const },
      third_step: { label: "3-р шат", variant: "outline" as const },
      fourth_step: { label: "4-р шат", variant: "destructive" as const },
    };

    const config =
      stepConfig[reviewerType as keyof typeof stepConfig] ||
      stepConfig.first_step;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div>Ачааллаж байна...</div>;
  }

  if (uniqueOrders.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Одоогоор хянагдахаар илгээгдсэн хүсэлт байхгүй байна</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {uniqueOrders.map((request) => {
        // Тухайн захиалгын ижил шатны шалгуулагчийн тоог тоолох
        const sameStepReviewers = reviewRequests.filter(
          (r) =>
            r.order_id === request.order_id &&
            r.reviewer_type === request.reviewer_type
        );

        const totalReviewers = sameStepReviewers.length;
        const reviewedCount = sameStepReviewers.filter(
          (r) => r.is_reviewed
        ).length;

        return (
          <Card
            key={`${request.order_id}-${request.reviewer_type}`}
            className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="font-semibold text-lg">
                      {request.orders.order_number}
                    </h3>
                    {getUrgencyBadge(request.orders.urgency_level)}
                    {getStepBadge(request.reviewer_type)}

                    {/* Шалгуулагчийн тоо ба статус */}
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700">
                      {reviewedCount}/{totalReviewers} шалгуулагч
                    </Badge>

                    {request.is_reviewed ? (
                      <Badge variant="outline">Та үнэлсэн</Badge>
                    ) : (
                      <Badge variant="default">Хянах шаардлагатай</Badge>
                    )}
                  </div>

                  <p className="text-gray-700 mb-1 font-medium">
                    {request.orders.title}
                  </p>
                  <p className="text-gray-600 text-sm mb-2">
                    {request.orders.description}
                  </p>

                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Хүсэлт гаргасан: {request.orders.profile.name}</p>
                    <p>Хэлтэс: {request.orders.profile.department_name}</p>
                    <p>
                      Илгээгдсэн:{" "}
                      {new Date(request.assigned_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="ml-4 text-right space-y-2">
                  {!request.is_reviewed ? (
                    <Button
                      onClick={() =>
                        handleReview(request.orders.id, request.reviewer_type)
                      }
                      className="w-full">
                      Хянах
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-center">
                        <Badge
                          variant={
                            request.status === "approved"
                              ? "default"
                              : request.status === "changes_requested"
                              ? "secondary"
                              : request.status === "rejected"
                              ? "destructive"
                              : "outline"
                          }
                          className="w-full justify-center">
                          {request.status === "approved"
                            ? "Та зөвшөөрсөн"
                            : request.status === "changes_requested"
                            ? "Та өөрчлөлт санал болгосон"
                            : request.status === "rejected"
                            ? "Та татгалзсан"
                            : "Хүлээгдэж байна"}
                        </Badge>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={() =>
                      handleViewDetails(
                        request.orders.id,
                        request.reviewer_type
                      )
                    }
                    className="w-full">
                    Дэлгэрэнгүй харах
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
