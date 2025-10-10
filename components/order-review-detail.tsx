// components/order-reviewer-detail.tsx
"use client";

import { useState, useEffect } from "react";
import { ReviewOrderForm } from "@/components/review-order-form";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { UnitType } from "@/types";
import { StepType, isValidStep } from "@/utils/workflow";
import { Badge } from "./ui/badge";

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
  urgency_level: string;
  created_at: string;
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
  requested_delivery_date: string;
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

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      // Одоогийн шалгуулагчийн мэдээлэл
      const { data: reviewer, error: reviewerError } = await supabase
        .from("order_reviewers")
        .select("*")
        .eq("order_id", orderId)
        .eq("profile_id", profile_id)
        .neq("is_reviewed", true)
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
          `
          id,
          order_number,
          title,
          description,
          status,
          urgency_level,
          created_at,
          requested_delivery_date,
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
  };

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
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
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
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Захиалга шалгуулах</h1>
        <p className="text-gray-600 mt-2">
          Захиалга #{order.order_number} - {order.title}
        </p>
        <Badge variant="outline" className="mt-2">
          {currentStep.replace("_", " ").toUpperCase()} шат
        </Badge>
      </div>

      <ReviewOrderForm
        order={order}
        orderItems={orderItems}
        onReviewComplete={fetchOrderDetails}
        currentStep={currentStep}
      />
    </div>
  );
}
