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

interface Profile {
  name: string;
  position_name: string;
  department_name: string;
}

interface ReviewData {
  id: number;
  reviewer_type: string;
  status: string;
  comments: string;
  assigned_at: string;
  completed_at: string;
  profile_id: string;
  profile: Profile | Profile[];
}

interface ReviewAccumulator {
  [key: string]: ReviewData;
}

export default function ReviewDetailsPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [reviewHistory, setReviewHistory] = useState<ReviewDetail[]>([]);
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
          profile_id,
          profile:profile_id (
            name,
            position_name,
            department_name
          )
        `
        )
        .eq("order_id", orderId)
        .neq("status", "pending")
        .order("reviewer_type", { ascending: true })
        .order("assigned_at", { ascending: true });

      if (reviewError) throw reviewError;

      const latestReviewsByStatus = Object.values(
        (reviewData || []).reduce((acc: ReviewAccumulator, row: ReviewData) => {
          const key = `${row.profile_id}-${row.status}`;
          if (
            !acc[key] ||
            new Date(row.assigned_at) > new Date(acc[key].assigned_at)
          ) {
            acc[key] = row;
          }
          return acc;
        }, {} as ReviewAccumulator)
      );

      setReviewHistory(
        (latestReviewsByStatus || []).map((review: ReviewData) => ({
          ...review,
          profile: Array.isArray(review.profile)
            ? review.profile[0]
            : review.profile,
        }))
      );
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
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Ачааллаж байна...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Үнэлгээний дэлгэрэнгүй</h1>

      {/* Үнэлгээний түүх */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Шат бүрийн үнэлгээ</h2>

        {reviewHistory.length > 0 ? (
          reviewHistory.map((review) => (
            <Card key={review.id} className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{getStepLabel(review.reviewer_type)}</span>
                  {getStatusBadge(review.status)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold">Шалгуулагч:</p>
                    <p className="font-medium">{review.profile.name}</p>
                    <p className="text-gray-600">
                      {review.profile.position_name}
                    </p>
                    <p className="text-gray-600">
                      {review.profile.department_name}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Хугацаа:</p>
                    <p className="text-gray-600">
                      Огноо:{" "}
                      {new Date(review.assigned_at).toLocaleDateString("mn-MN")}
                    </p>
                    {review.completed_at && (
                      <p className="text-gray-600">
                        Дууссан:{" "}
                        {new Date(review.completed_at).toLocaleDateString(
                          "mn-MN"
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {review.comments && (
                  <div className="mt-4">
                    <p className="font-semibold">Тайлбар:</p>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded mt-1 border">
                      {review.comments}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-gray-500">
                <p>Үнэлгээний түүх олдсонгүй</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
