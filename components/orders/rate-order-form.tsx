"use client";

import { useState, useEffect, useCallback } from "react";
import { RateItemForm } from "@/components/orders/rate-item-form";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { OrderDetails, OrderItem, OrderStep } from "@/types/rate";

interface RateOrderFormProps {
  order_instance_id: string;
  profile_id: string;
}

export default function RateOrderForm({
  order_instance_id,
  profile_id,
}: RateOrderFormProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [currentStep, setCurrentStep] = useState<OrderStep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchOrderDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("order_instance_id", order_instance_id);
      console.log("reviewer_profile_id", profile_id);

      // 1. Өөрийн pending reviewer мэдээлэл + step мэдээлэл авах
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
        `
        )
        .eq("order_instance_id", order_instance_id)
        .eq("reviewer_profile_id", profile_id)
        .eq("status", "pending")
        .single();

      if (reviewerError || !reviewer) {
        console.error("Reviewer error:", reviewerError);
        setError(
          "Таны шалгах эрхтэй захиалга олдсонгүй эсвэл аль хэдийн шалгагдсан байна."
        );
        return;
      }

      if (reviewer.order_steps) {
        setCurrentStep(reviewer.order_steps as unknown as OrderStep);
      }

      // 2. Order instance + order + created profile мэдээлэл авах
      const { data: instance, error: instanceError } = await supabase
        .from("order_instances")
        .select(
          `
    id,
    status,
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
  `
        )
        .eq("id", order_instance_id)
        .single();

      if (instanceError || !instance?.orders) {
        throw new Error("Захиалгын мэдээлэл авахад алдаа гарлаа");
      }
      console.log("instances:", instance);

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
        `
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
      emergency: { label: "Яаралтай", className: "bg-red-100 text-red-800" },
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
      other: { label: "Бусад", className: "bg-blue-100 text-blue-800" },
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
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Захиалга шалгах</h1>
        <div className="flex flex-wrap gap-3">
          <Badge variant="outline" className="text-lg py-1 px-3">
            {currentStep.step_order}-р алхам: {currentStep.step_name}
          </Badge>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Захиалгын мэдээлэл</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-gray-600">Дугаар</Label>
              <p className="text-lg font-semibold">{order.order_number}</p>
            </div>
            <div>
              <Label className="text-gray-600">Гарчиг</Label>
              <p className="text-lg font-semibold">{order.title}</p>
            </div>
            <div>
              <Label className="text-gray-600">Төрөл</Label>
              <div className="mt-1">{getOrderTypeBadge(order.order_type)}</div>
            </div>
            <div>
              <Label className="text-gray-600">Хүсэлт гаргагч</Label>
              <p className="font-medium">
                {order.profile?.name || "Тодорхойгүй"}
              </p>
              <p className="text-sm text-gray-600">
                {order.profile?.department_name}
              </p>
            </div>
            <div>
              <Label className="text-gray-600">
                Хүсэж буй хэрэгцээт огноо:
              </Label>
              <p>{formatDate(order.requested_delivery_date)}</p>
            </div>
            <div>
              <Label className="text-gray-600">Үүссэн огноо</Label>
              <p>{formatDate(order.created_at)}</p>
            </div>
            {order.description && (
              <div className="md:col-span-2">
                <Label className="text-gray-600">Тайлбар</Label>
                <p className="mt-2 p-4 bg-gray-50 rounded-lg">
                  {order.description}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <RateItemForm
        orderItems={orderItems}
        currentStep={currentStep}
        order_instance_id={parseInt(order_instance_id)}
        reviewer_profile_id={parseInt(profile_id)}
        onReviewComplete={fetchOrderDetails}
      />
    </div>
  );
}
