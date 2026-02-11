// app/(protected)/orders/[id]/imp/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { StatusHistory } from "@/components/orders/status-history";
import { updateOrderManagementStatus } from "@/actions/order-process";

const MANAGEMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Хүлээгдэж байна" },
  { value: "processing", label: "Боловсруулж байна" },
  { value: "completed", label: "Дууссан" },
  { value: "cancelled", label: "Цуцлагдсан" },
  { value: "on_hold", label: "Түр зогссон" },
];

export default function OrderManagementPage() {
  const params = useParams();
  const supabase = createClient();
  const orderId = params.id as string;
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newManagementStatus, setNewManagementStatus] = useState("");
  const [reason, setReason] = useState("");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  async function fetchOrder() {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          profile:created_profile(*)
        `,
        )
        .eq("id", orderId)
        .single();

      if (error) throw error;
      setOrder(data);
      setNewManagementStatus(data.management_status || "");
    } catch (err) {
      console.error(err);
      toast.error("Захиалгын мэдээлэл авахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus() {
    if (!newManagementStatus) {
      toast.error("Статус сонгоно уу");
      return;
    }

    setUpdating(true);
    try {
      await updateOrderManagementStatus({
        orderId,
        newStatus: newManagementStatus,
        reason,
        currentOrderStatus: order?.status,
        currentManagementStatus: order?.management_status,
      });

      toast.success("Удирдлагын статус амжилттай шинэчлэгдлээ");
      setHistoryRefreshKey((k) => k + 1);
      setReason("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Статус шинэчлэхэд алдаа гарлаа");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-center">Ачаалж байна...</div>;
  }

  if (!order) {
    return <div className="p-6 text-center">Захиалга олдсонгүй</div>;
  }

  // Баталгаажсан эсвэл өөрчлөгдөж батлагдсан эсэхийг шалгах
  const isApproved =
    order.status === "approved" || order.status === "changes_requested";

  if (!isApproved) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">
              Энэ захиалга баталгаажаагүй байна
            </h2>
            <p className="text-muted-foreground mb-4">
              Удирдлагын статус өөрчлөх боломжгүй
            </p>
            <Button asChild>
              <a href={`/orders/${orderId}`}>Ерөнхий хуудас руу буцах</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Захиалгын удирдлага</h1>
        <Button asChild variant="outline">
          <a href={`/orders/manage`}>Ерөнхий мэдээлэл рүү буцах</a>
        </Button>
      </div>

      {/* Захиалгын үндсэн мэдээлэл */}
      <Card>
        <CardHeader>
          <CardTitle>Захиалгын мэдээлэл</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Гарчиг
              </h3>
              <p className="text-lg">{order.title}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Үүсгэгч
              </h3>
              <p>{order.profile?.name}</p>
              <p className="text-sm text-muted-foreground">
                {order.profile?.department_name}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Баталгааны статус
              </h3>
              <Badge
                variant={
                  order.status === "approved"
                    ? "default"
                    : order.status === "changes_requested"
                      ? "outline"
                      : "secondary"
                }>
                {order.status === "approved"
                  ? "Баталгаажсан"
                  : order.status === "changes_requested"
                    ? "Өөрчлөгдөж батлагдсан"
                    : order.status}
              </Badge>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Удирдлагын статус
              </h3>
              {order.management_status ? (
                <Badge
                  variant={
                    order.management_status === "completed"
                      ? "default"
                      : order.management_status === "processing"
                        ? "secondary"
                        : order.management_status === "cancelled"
                          ? "destructive"
                          : "outline"
                  }>
                  {MANAGEMENT_STATUS_OPTIONS.find(
                    (opt) => opt.value === order.management_status,
                  )?.label || order.management_status}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Тохируулаагүй
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Статус өөрчлөх хэсэг */}
      <Card>
        <CardHeader>
          <CardTitle>Удирдлагын статус өөрчлөх</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Шинэ статус
              </label>
              <Select
                value={newManagementStatus}
                onValueChange={setNewManagementStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Статус сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {MANAGEMENT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Шалтгаан (заавал биш)
              </label>
              <Textarea
                placeholder="Статус өөрчлөх шалтгаан..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleUpdateStatus}
                disabled={
                  updating ||
                  !newManagementStatus ||
                  newManagementStatus === order.management_status
                }>
                {updating ? "Хадгалж байна..." : "Хадгалах"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Статус түүх */}
      <StatusHistory orderId={orderId} refreshKey={historyRefreshKey} />
    </div>
  );
}
