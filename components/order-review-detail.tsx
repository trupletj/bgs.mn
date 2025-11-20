// components/order-reviewer-detail.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ReviewOrderForm } from "@/components/review-order-form";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { SparePartType, UnitType } from "@/types/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StepType, isValidStep } from "@/utils/workflow";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { PreviousReviewersActions } from "./orders/previous-reviewers-action";

interface OrderReviewerDetailProps {
  orderId: string;
  profile_id: string;
}

interface OrderDetails {
  id: string;
  order_number: string;
  title: string;
  description: string;
  status: string;
  requested_delivery_date?: string;
  urgency_level: string;
  created_at: string;
  order_type: string;
  profile: {
    name: string;
    department_name: string;
  };
}

interface OrderItem {
  id: string;
  part_name: string;
  part_number: string;
  quantity: number;
  notes: string;
  unit: UnitType;
  spare_type: SparePartType;
  requested_delivery_date: string;
  image_url: string | null;
}

export default function OrderReviewerDetail({
  orderId,
  profile_id,
}: OrderReviewerDetailProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [currentStep, setCurrentStep] = useState<StepType>("first_step");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId, profile_id]);

  const getOrderTypeBadge = (orderType: string) => {
    const typeConfig = {
      emergency: {
        label: "Яаралтай",
        className: "bg-red-100 text-red-800",
      },
      service: {
        label: "Үйлчилгээний",
        className: "bg-yellow-100 text-yellow-800",
      },
      "major repairs": {
        label: "Их засвар",
        className: "bg-orange-100 text-orange-800",
      },
      "safety reserves": {
        label: "Аюулгүйн нөөц",
        className: "bg-green-100 text-green-800",
      },
      other: {
        label: "Бусад",
        className: "bg-blue-100 text-blue-800",
      },
    };

    const config =
      typeConfig[orderType as keyof typeof typeConfig] || typeConfig.other;

    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Тодорхойгүй";

    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year} оны ${month} сарын ${day}-нд`;
  };

  const fetchOrderDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      // Шалгуулагчийн мэдээлэл
      const { data: reviewer, error: reviewerError } = await supabase
        .from("order_reviewers")
        .select("*")
        .eq("order_id", orderId)
        .eq("profile_id", profile_id)
        .neq("is_reviewed", true)
        .neq("status", "pending")
        .maybeSingle();

      if (reviewerError) {
        console.error("Reviewer error:", reviewerError);
        throw new Error("Шалгуулагчийн мэдээлэл авахад алдаа гарлаа");
      }

      if (!reviewer) {
        setError("Шалгуулагчийн мэдээлэл олдсонгүй");
        return;
      }

      if (isValidStep(reviewer.reviewer_type)) {
        setCurrentStep(reviewer.reviewer_type);
      }

      // Захиалгын мэдээлэл
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          `*,
        profile:created_profile (
          name,
          department_name
        )
      `
        )
        .eq("id", orderId)
        .single();

      if (orderError) {
        console.error("Order error:", orderError);
        throw new Error("Захиалгын мэдээлэл авахад алдаа гарлаа");
      }

      if (!orderData) {
        setError("Захиалга олдсонгүй");
        return;
      }

      // Захиалгын эд зүйлс
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      if (itemsError) {
        console.error("Items error:", itemsError);
        throw new Error("Сэлбэгүүдийн мэдээлэл авахад алдаа гарлаа");
      }

      setOrder({
        ...orderData,
        profile: Array.isArray(orderData.profile)
          ? orderData.profile[0]
          : orderData.profile,
      });
      setOrderItems(itemsData || []);
    } catch (error) {
      console.error("Fetch error:", error);
      setError(error instanceof Error ? error.message : "Алдаа гарлаа");
      toast.error("Мэдээлэл авахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, [orderId, profile_id]);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-3">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-500">{error}</div>
        <div className="text-center mt-4">
          <button
            onClick={fetchOrderDetails}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Дахин оролдох
          </button>
        </div>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-500">Захиалга олдсонгүй</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Захиалга шалгуулах</h1>

        <Badge variant="outline" className="mt-2">
          {currentStep.replace("_", " ").toUpperCase()} шат
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Захиалгын дэлгэрэнгүй</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Гарчиг</Label>
              <p className="font-semibold">{order.title}</p>
            </div>
            <div>
              <Label className="text-gray-600">Захиалгын төрөл</Label>
              <div className="mt-1">{getOrderTypeBadge(order.order_type)}</div>
            </div>
            <div>
              <Label className="text-gray-600">
                Хүргэлтийн хүсэгдсэн огноо
              </Label>
              <p className="font-medium">
                {formatDate(order.requested_delivery_date)}
              </p>
            </div>
            <div>
              <Label className="text-gray-600">Хүсэлт гаргасан</Label>
              <p>{order.profile.name}</p>
              <p className="text-sm text-gray-600">
                {order.profile.department_name}
              </p>
            </div>
            {order.description && (
              <div className="md:col-span-2">
                <Label className="text-gray-600">Тайлбар</Label>
                <p className="mt-1 p-3 bg-gray-50 rounded-md">
                  {order.description}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <PreviousReviewersActions orderId={orderId} currentStep={currentStep} />

      <ReviewOrderForm
        order={order}
        orderItems={orderItems}
        // onReviewComplete={fetchOrderDetails}
        currentStep={currentStep}
      />
    </div>
  );
}
