"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

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
}

export function ReviewRequestsList() {
  const [reviewRequests, setReviewRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchReviewRequests();
  }, []);

  const fetchReviewRequests = async () => {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Хэрэглэгч олдсонгүй");
      }
      const { data: id } = await supabase
        .from("profile")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      const { data: reviewer } = await supabase
        .from("order_reviewers")
        .select("*")
        .eq("profile_id", id?.id);

      // Шалгуулахаар илгээгдсэн хүсэлтүүдийг авах
      const { data, error } = await supabase
        .from("order_reviewers")
        .select(
          `
          id,
          order_id,
          reviewer_type,
          assigned_at,
          status,
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
        .eq("profile_id", id?.id)
        .eq("status", "pending")
        .order("assigned_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setReviewRequests(
        (data || []).map((item: any) => ({
          ...item,
          order: {
            ...(Array.isArray(item.order) ? item.order[0] : item.order),
            requester: Array.isArray(item.order?.requester)
              ? item.order.requester[0]
              : item.order?.requester,
          },
        }))
      );
    } catch (error) {
      toast.error("Хүсэлтүүдийг авахад алдаа гарлаа");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (orderId: number) => {
    router.push(`/orders/${orderId}/review`);
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

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="space-y-2">
              <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
            <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }

  if (reviewRequests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Одоогоор хянагдахаар илгээгдсэн хүсэлт байхгүй байна</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviewRequests.map((request) => (
        <Card key={request.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="font-semibold text-lg">
                    {request.orders.order_number}
                  </h3>
                  {getUrgencyBadge(request.orders.urgency_level)}
                  <Badge variant="outline">
                    {request.reviewer_type === "in_reviewer"
                      ? "Техник шалгуулалт"
                      : "Бусад"}
                  </Badge>
                </div>

                <p className="text-gray-700 mb-1">{request.orders.title}</p>

                <div className="text-sm text-gray-500 space-y-1">
                  <p>Хүсэлт гаргасан: {request.orders.profile.name}</p>
                  <p>Хэлтэс: {request.orders.profile.name}</p>
                  <p>
                    Илгээгдсэн:{" "}
                    {new Date(request.assigned_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => handleReview(request.orders.id)}
                className="ml-4"
              >
                Хянах
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
