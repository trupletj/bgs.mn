// components/order-review-detail.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";

interface OrderDetails {
  id: string;
  order_number: string;
  title: string;
  description: string;
  status: string;
  urgency_level: string;
  requested_delivery_date?: string;
  created_at: string;
  profile: {
    name: string;
    department_name: string;
  };
}

interface OrderItem {
  id: string;
  part_name: string;
  part_number?: string;
  quantity: number;
  part_description?: string;
}

interface OrderReviewer {
  id: string;
  status: string;
  comments?: string;
  completed_at: string;
  is_reviewed: boolean;
}

interface SubOrderItem {
  id: string;
  order_item_id: string;
  quantity: number;
  status: string;
  description?: string;
  created_at: string;
}

interface ReviewedOrderDetailProps {
  orderId: string;
  profile_id: string;
}

export default function ReviewedOrderDetail({
  orderId,
  profile_id,
}: ReviewedOrderDetailProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [reviewer, setReviewer] = useState<OrderReviewer | null>(null);
  const [subOrderItems, setSubOrderItems] = useState<SubOrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const supabase = createClient();
      const { data: orderData, error } = await supabase
        .from("orders")
        .select(
          `id,
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

      if (error) throw error;

      // Захиалгын эд зүйлс
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      if (itemsError) throw itemsError;

      const { data: subItemsData, error: subItemsError } = await supabase
        .from("sub_order_item")
        .select("*")
        .in("order_item_id", itemsData?.map((item) => item.id) || []);
      if (subItemsError) throw subItemsError;

      const { data: reviewerData, error: reviewerError } = await supabase
        .from("order_reviewers")
        .select("*")
        .eq("order_id", orderId)
        .eq("profile_id", profile_id)
        .single();
      if (reviewerError) throw reviewerError;

      setOrder({
        ...orderData,
        profile: Array.isArray(orderData.profile)
          ? orderData.profile[0]
          : orderData.profile,
      });
      setOrderItems(itemsData || []);
      setReviewer(reviewerData);
      setSubOrderItems(subItemsData || []);
    } catch (error) {
      console.error("Мэдээлэл авахад алдаа гарлаа:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    const urgencyConfig = {
      low: { label: "Бага", className: "bg-gray-100 text-gray-800" },
      medium: { label: "Дунд", className: "bg-blue-100 text-blue-800" },
      high: { label: "Яаралтай", className: "bg-orange-100 text-orange-800" },
      critical: { label: "Нэн яаралтай", className: "bg-red-100 text-red-800" },
    };

    const config =
      urgencyConfig[urgency as keyof typeof urgencyConfig] ||
      urgencyConfig.medium;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: {
        label: "Зөвшөөрсөн",
        className: "bg-green-100 text-green-800",
      },
      rejected: { label: "Татгалзсан", className: "bg-red-100 text-red-800" },
      changes_requested: {
        label: "Өөрчлөлт шаардсан",
        className: "bg-yellow-100 text-yellow-800",
      },
      pending: {
        label: "Хүлээгдэж буй",
        className: "bg-gray-100 text-gray-800",
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getSubItemStatusBadge = (status: string) => {
    const statusConfig = {
      changed_approved: {
        label: "Өөрчилж зөвшөөрсөн",
        className: "bg-green-100 text-green-800",
      },
      pending_review: {
        label: "Шалгалт хүлээгдэж буй",
        className: "bg-yellow-100 text-yellow-800",
      },
      approved: { label: "Зөвшөөрсөн", className: "bg-blue-100 text-blue-800" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      className: "bg-gray-100 text-gray-800",
    };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year} оны ${month} сарын ${day}`;
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

  if (!order || !reviewer) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-500">
          Захиалгын мэдээлэл олдсонгүй
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Толгой мэдээлэл */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">Захиалгын шалгалтын дэлгэрэнгүй</h1>
        <p className="text-gray-600 mt-2">
          Захиалга #{order.order_number} - {order.title}
        </p>
      </div>

      {/* Шалгалтын үр дүн */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Шалгалтын үр дүн</span>
            {getStatusBadge(reviewer.status)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Шалгалтын статус</Label>
              <p className="font-semibold">{getStatusBadge(reviewer.status)}</p>
            </div>
            <div>
              <Label className="text-gray-600">Шалгасан огноо</Label>
              <p>
                {reviewer.completed_at
                  ? formatDate(reviewer.completed_at)
                  : "Шалгаагүй"}
              </p>
            </div>
            {reviewer.comments && (
              <div className="md:col-span-2">
                <Label className="text-gray-600">Тайлбар</Label>
                <p className="mt-1 p-3 bg-gray-50 rounded-md">
                  {reviewer.comments}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Захиалгын мэдээлэл */}
      <Card>
        <CardHeader>
          <CardTitle>Захиалгын дэлгэрэнгүй</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Захиалгын дугаар</Label>
              <p className="font-semibold">{order.order_number}</p>
            </div>
            <div>
              <Label className="text-gray-600">Гарчиг</Label>
              <p className="font-semibold">{order.title}</p>
            </div>
            <div>
              <Label className="text-gray-600">Яаралтай түвшин</Label>
              <div className="mt-1">{getUrgencyBadge(order.urgency_level)}</div>
            </div>
            <div>
              <Label className="text-gray-600">
                Хүргэлтийн хүсэгдсэн огноо
              </Label>
              <p className="font-medium">
                {order.requested_delivery_date
                  ? formatDate(order.requested_delivery_date)
                  : "Тодорхойгүй"}
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

      {/* Сэлбэгүүд */}
      <Card>
        <CardHeader>
          <CardTitle>Сэлбэгүүд</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orderItems.map((item) => {
              const subItem = subOrderItems.find(
                (sub) => sub.order_item_id === item.id
              );
              const finalQuantity = subItem ? subItem.quantity : item.quantity;
              const hasChanges = subItem && subItem.quantity !== item.quantity;

              return (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div>
                      <Label className="text-gray-600">Сэлбэгийн нэр</Label>
                      <p className="font-medium">{item.part_name}</p>
                      {item.part_number && (
                        <p className="text-sm text-gray-600">
                          Дугаар: {item.part_number}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label className="text-gray-600">Тоо ширхэг</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="font-medium">{finalQuantity}</span>
                        {hasChanges && (
                          <>
                            <span className="text-sm text-gray-600 line-through">
                              ({item.quantity})
                            </span>
                            <Badge
                              variant="outline"
                              className="bg-yellow-100 text-yellow-800">
                              Өөрчлөгдсөн
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="text-gray-600">Тайлбар</Label>
                      <p className="text-sm text-gray-700 mt-1">
                        {item.part_description || "Тайлбаргүй"}
                      </p>
                    </div>

                    <div>
                      <Label className="text-gray-600">Шалгалтын статус</Label>
                      <div className="mt-1">
                        {subItem ? (
                          getSubItemStatusBadge(subItem.status)
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-gray-100 text-gray-800">
                            Өөрчлөгдөөгүй
                          </Badge>
                        )}
                      </div>
                      {subItem?.description && (
                        <p className="text-xs text-gray-600 mt-1">
                          {subItem.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Өөрчлөлтийн түүх */}
      {subOrderItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Өөрчлөлтийн түүх</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {subOrderItems.map((subItem) => {
                const originalItem = orderItems.find(
                  (item) => item.id === subItem.order_item_id
                );
                return (
                  <div key={subItem.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{originalItem?.part_name}</p>
                        <p className="text-sm text-gray-600">
                          Тоо ширхэг: {subItem.quantity}
                          {originalItem &&
                            subItem.quantity !== originalItem.quantity && (
                              <span className="line-through text-gray-400 ml-2">
                                ({originalItem.quantity})
                              </span>
                            )}
                        </p>
                        {subItem.description && (
                          <p className="text-sm text-gray-700 mt-1">
                            {subItem.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {getSubItemStatusBadge(subItem.status)}
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDate(subItem.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
