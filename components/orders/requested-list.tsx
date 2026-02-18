// components/review-requests-list.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import { getAwaitingOrders, AwaitingOrder } from "@/actions/orders";
import {
  Clock,
  User,
  Building,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ReviewRequestProp {
  profile_id: string;
  type: "pending" | "reviewed";
}

export function RequestedList({ profile_id, type }: ReviewRequestProp) {
  const [reviewRequests, setReviewRequests] = useState<AwaitingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (profile_id) {
      fetchReviewRequests();
    }
  }, [profile_id]);

  const fetchReviewRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAwaitingOrders(profile_id);
      const filtered = (data || []).filter((request) => {
        if (type === "pending") {
          return request.status === "pending" || !request.status;
        } else {
          return request.status && request.status !== "pending";
        }
      });
      setReviewRequests(filtered);
    } catch (error) {
      console.error("Error fetching review requests:", error);
      setError("Хүсэлтүүдийг авахад алдаа гарлаа");
      toast.error("Хүсэлтүүдийг авахад алдаа гарлаа");
      setReviewRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (orderId: number) => {
    router.push(`/orders/${orderId}/rate`);
  };

  const getUrgencyBadge = (urgency: string) => {
    const urgencyConfig: Record<
      string,
      {
        label: string;
        variant: "secondary" | "outline" | "destructive";
        color: string;
      }
    > = {
      service: {
        label: "Үйлчилгээний",
        variant: "outline",
        color: "bg-green-100 text-green-800",
      },
      "major repairs": {
        label: "Их засвар",
        variant: "outline",
        color: "bg-yellow-100 text-yellow-800",
      },
      "safety reserves": {
        label: "Аюулгүйн нөөц",
        variant: "outline",
        color: "bg-orange-100 text-orange-800",
      },
      emergency: {
        label: "Нэн яаралтай",
        variant: "destructive",
        color: "bg-red-100 text-red-800",
      },
      other: {
        label: "Бусад",
        variant: "outline",
        color: "bg-gray-100 text-gray-800",
      },
    };

    // Safely access the urgencyConfig with a fallback
    const config = urgencyConfig[urgency] || urgencyConfig["other"];

    return (
      <Badge variant={config.variant} className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
        icon: React.ReactNode;
      }
    > = {
      pending: {
        label: "Хүлээгдэж байна",
        variant: "outline",
        icon: <Clock className="h-3 w-3 mr-1" />,
      },
      approved: {
        label: "Зөвшөөрсөн",
        variant: "default",
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
      },
      rejected: {
        label: "Татгалзсан",
        variant: "destructive",
        icon: <XCircle className="h-3 w-3 mr-1" />,
      },
      changes_requested: {
        label: "Өөрчлөлт шаардсан",
        variant: "secondary",
        icon: <FileText className="h-3 w-3 mr-1" />,
      },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge variant={config.variant} className="flex items-center">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Тодорхойгүй";

    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year} оны ${month} сарын ${day}-нд`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex justify-between">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="h-12 w-12 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-600 mb-2">
          Алдаа гарлаа
        </h3>
        <p className="text-gray-500 max-w-md mx-auto mb-4">{error}</p>
        <Button onClick={fetchReviewRequests} variant="outline">
          Дахин оролдох
        </Button>
      </div>
    );
  }

  if (!reviewRequests || reviewRequests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <FileText className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-600 mb-2">
          Шалгагдах хүсэлт олдсонгүй
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Одоогоор танд шалгагдахаар илгээгдсэн захиалгын хүсэлт байхгүй байна.
        </p>
        <Button
          onClick={fetchReviewRequests}
          variant="outline"
          className="mt-4">
          Шинэчлэх
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviewRequests.map((request) => {
        // Суурь өгөгдөл авах
        const instance = request.order_instances || request.order_instance;

        if (!instance) {
          console.warn("No instance found for request:", request);
          return null;
        }

        const order = (instance as any).orders || (instance as any).order;
        if (!order) {
          console.warn("No order found for instance:", instance);
          return null;
        }

        // Profile мэдээлэл авах
        const profile = order.profile || (order as any).created_profile;

        return (
          <Card
            key={`${request.id}-${instance.id}`}
            className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
            <CardContent className="px-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {getUrgencyBadge(order.urgency_level || "")}
                    <Badge
                      variant="secondary"
                      className="bg-blue-50 text-blue-700">
                      {instance.current_step_order || 1}-р шат
                    </Badge>
                    {getStatusBadge(request.status || "pending")}
                  </div>

                  <h4 className="font-semibold text-lg text-gray-800 mb-2">
                    {order.title || "Гарчиггүй захиалга"}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <User className="h-4 w-4 mr-2" />
                        <span className="font-medium">Хүсэлт гаргасан: </span>
                        <span className="ml-2">
                          {profile?.name || "Тодорхойгүй"}
                        </span>
                      </div>
                      {profile?.department_name && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Building className="h-4 w-4 mr-2" />
                          <span className="font-medium">Хэлтэс: </span>
                          <span className="ml-2">
                            {profile.department_name}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        <span className="font-medium">Хүсэлт илгээсэн: </span>
                        <span className="ml-2">
                          {formatDate(request.created_at)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">
                          Захиалгын хэрэгцээт хязгаар огноо:{" "}
                        </span>
                        {order.requested_delivery_date
                          ? formatDate(order.requested_delivery_date)
                          : "Тодорхойгүй"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col gap-2 min-w-[180px]">
                  {request.status === "pending" || !request.status ? (
                    <Button
                      onClick={() => handleReview(order.id)}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      size="lg">
                      Шалгах
                    </Button>
                  ) : (
                    <div className="w-full p-3 bg-gray-50 rounded-lg border text-center">
                      <div className="font-medium text-gray-700 mb-1">
                        Та аль хэдийн шалгасан
                      </div>
                      <div className="text-sm text-gray-500">
                        Статус:{" "}
                        {request.status === "approved"
                          ? "Зөвшөөрсөн"
                          : request.status === "rejected"
                            ? "Татгалзсан"
                            : "Өөрчлөлт шаардсан"}
                      </div>
                    </div>
                  )}

                  <Link href={`/orders/${order.id}`} className="w-full">
                    <Button variant="outline" className="w-full" size="lg">
                      Дэлгэрэнгүй харах
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
