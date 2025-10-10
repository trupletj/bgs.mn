// app/orders/[id]/review/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ReviewOrderForm } from "@/components/review-order-form";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface OrderDetails {
  id: number;
  order_number: string;
  title: string;
  description: string;
  status: string;
  urgency_level: string;
  created_at: string;
  users: {
    nice_name: string;
    department_name: string;
  };
}

interface OrderItem {
  id: number;
  part_name: string;
  part_number: string;
  quantity: number;
  notes: string;
}

export default function ReviewOrderPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const supabase = createClient();

      // Захиалгын дэлгэрэнгүй мэдээлэл
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
          users:created_by (
            nice_name,
            department_name
          )
        `
        )
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      // Захиалгын эд зүйлс
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      setOrder({
        ...orderData,
        users: Array.isArray(orderData.users)
          ? orderData.users[0]
          : orderData.users,
      });
      setOrderItems(itemsData || []);
    } catch (error) {
      toast.error("Захиалгын мэдээлэл авахад алдаа гарлаа");
      console.error(error);
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
      </div>

      <ReviewOrderForm
        order={order}
        orderItems={orderItems}
        onReviewComplete={fetchOrderDetails}
      />
    </div>
  );
}
