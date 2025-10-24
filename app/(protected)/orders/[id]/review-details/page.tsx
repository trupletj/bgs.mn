// app/orders/[id]/review-details/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface ReviewDetail {
  id: number;
  reviewer_type: string;
  status: string;
  comments: string;
  assigned_at: string;
  completed_at: string;
  profile: {
    name: string;
    position_name: string;
    department_name: string;
  };
}

interface OrderItemChange {
  id: number;
  order_item_id: number;
  reviewer_id: number;
  old_quantity: number;
  new_quantity: number;
  changed_at: string;
  profile: {
    name: string;
  };
  order_item: {
    part_name: string;
    part_number?: string;
  };
}

interface Profile {
  name: string;
  position_name: string;
  department_name: string;
}

interface SimpleProfile {
  name: string;
}

interface OrderItem {
  part_name: string;
  part_number?: string;
}

interface ReviewData {
  id: number;
  reviewer_type: string;
  status: string;
  comments: string;
  assigned_at: string;
  completed_at: string;
  profile: Profile | Profile[];
}

interface ChangesData {
  id: number;
  order_item_id: number;
  reviewer_id: number;
  old_quantity: number;
  new_quantity: number;
  changed_at: string;
  profile: SimpleProfile | SimpleProfile[];
  order_item: OrderItem | OrderItem[];
}

export default function ReviewDetailsPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [reviewHistory, setReviewHistory] = useState<ReviewDetail[]>([]);
  const [itemChanges, setItemChanges] = useState<OrderItemChange[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviewDetails = useCallback(async () => {
    try {
      const supabase = createClient();

      // Үнэлгээний түүх
      const { data: reviewData, error: reviewError } = await supabase
        .from("order_reviewers")
        .select(
          `
          id,
          reviewer_type,
          status,
          comments,
          assigned_at,
          completed_at,
          profile:profile_id (
            name,
            position_name,
            department_name
          )
        `
        )
        .eq("order_id", orderId)
        .order("reviewer_type", { ascending: true })
        .order("assigned_at", { ascending: true });

      if (reviewError) throw reviewError;

      // Сэлбэгийн өөрчлөлтүүд
      // const { data: changesData, error: changesError } = await supabase
      //   .from("order_item_changes")
      //   .select(
      //     `
      //     id,
      //     order_item_id,
      //     reviewer_id,
      //     old_quantity,
      //     new_quantity,
      //     changed_at,
      //     profile:reviewer_id (
      //       name
      //     ),
      //     order_item:order_item_id (
      //       part_name,
      //       part_number
      //     )
      //   `
      //   )
      //   .eq("order_id", orderId)
      //   .order("changed_at", { ascending: true });

      // if (changesError) throw changesError;

      setReviewHistory(
        (reviewData || []).map((review: ReviewData) => ({
          ...review,
          profile: Array.isArray(review.profile)
            ? review.profile[0]
            : review.profile,
        }))
      );
      // setItemChanges(
      //   (changesData || []).map((change: ChangesData) => ({
      //     ...change,
      //     profile: Array.isArray(change.profile)
      //       ? change.profile[0]
      //       : change.profile,
      //     order_item: Array.isArray(change.order_item)
      //       ? change.order_item[0]
      //       : change.order_item,
      //   }))
      // );
    } catch (error) {
      toast.error("Үнэлгээний дэлгэрэнгүй мэдээллийг авахад алдаа гарлаа");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchReviewDetails();
  }, [fetchReviewDetails]);

  const getStepLabel = (step: string) => {
    const stepLabels: Record<string, string> = {
      first_step: "1-р шат",
      second_step: "2-р шат",
      third_step: "3-р шат",
      fourth_step: "4-р шат",
    };
    return stepLabels[step] || step;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Хүлээгдэж байна", variant: "outline" as const },
      approved: { label: "Зөвшөөрсөн", variant: "default" as const },
      changes_requested: {
        label: "Өөрчлөлттэй",
        variant: "secondary" as const,
      },
      rejected: { label: "Татгалзсан", variant: "destructive" as const },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div>Ачааллаж байна...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Үнэлгээний дэлгэрэнгүй</h1>

      {/* Үнэлгээний түүх */}
      <div className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold">Шат бүрийн үнэлгээ</h2>
        {reviewHistory.map((review) => (
          <Card key={review.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{getStepLabel(review.reviewer_type)}</span>
                {getStatusBadge(review.status)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold">Шалгуулагч:</p>
                  <p>{review.profile.name}</p>
                  <p>{review.profile.position_name}</p>
                  <p>{review.profile.department_name}</p>
                </div>
                <div>
                  <p className="font-semibold">Хугацаа:</p>
                  <p>
                    Огноо: {new Date(review.assigned_at).toLocaleDateString()}
                  </p>
                  {review.completed_at && (
                    <p>
                      Дууссан:{" "}
                      {new Date(review.completed_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {review.comments && (
                <div className="mt-4">
                  <p className="font-semibold">Тайлбар:</p>
                  <p className="text-gray-700 bg-gray-50 p-2 rounded mt-1">
                    {review.comments}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Сэлбэгийн өөрчлөлтүүд */}
      {itemChanges.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Сэлбэгийн өөрчлөлтүүд</h2>
          {itemChanges.map((change) => (
            <Card key={change.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {change.order_item.part_name}
                  {change.order_item.part_number &&
                    ` (${change.order_item.part_number})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold">Өөрчилсөн хүн:</p>
                    <p>{change.profile.name}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Өөрчлөлт:</p>
                    <p>
                      <span className="line-through text-red-600 mr-2">
                        {change.old_quantity}
                      </span>
                      <span className="text-green-600 font-semibold">
                        → {change.new_quantity}
                      </span>
                    </p>
                    <p>
                      Огноо: {new Date(change.changed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
