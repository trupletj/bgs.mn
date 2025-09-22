// components/review/ReviewOrderForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  part_number?: string;
  quantity: number;
  notes?: string;
}

interface ReviewOrderFormProps {
  order: OrderDetails;
  orderItems: OrderItem[];
  onReviewComplete: () => void;
}

export function ReviewOrderForm({
  order,
  orderItems,
  onReviewComplete,
}: ReviewOrderFormProps) {
  const [comments, setComments] = useState("");
  const [changes, setChanges] = useState<
    Record<number, { quantity: number; notes?: string }>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleQuantityChange = (itemId: number, newQuantity: number) => {
    setChanges((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity: newQuantity },
    }));
  };

  const handleNotesChange = (itemId: number, newNotes: string) => {
    setChanges((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes: newNotes },
    }));
  };

  const getUrgencyBadge = (urgency: string) => {
    const urgencyConfig = {
      low: {
        label: "Бага",
        variant: "secondary" as const,
        className: "bg-gray-100 text-gray-800",
      },
      medium: {
        label: "Дунд",
        variant: "outline" as const,
        className: "bg-blue-100 text-blue-800",
      },
      high: {
        label: "Яаралтай",
        variant: "destructive" as const,
        className: "bg-orange-100 text-orange-800",
      },
      critical: {
        label: "Нэн яаралтай",
        variant: "destructive" as const,
        className: "bg-red-100 text-red-800",
      },
    };

    const config =
      urgencyConfig[urgency as keyof typeof urgencyConfig] ||
      urgencyConfig.medium;

    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const handleApprove = async () => {
    await submitReview("approved");
  };

  const handleReject = async () => {
    if (!comments.trim()) {
      toast.error("Татгалзах шалтгаанаа оруулна уу");
      return;
    }
    await submitReview("rejected");
  };

  const handleRequestChanges = async () => {
    if (Object.keys(changes).length === 0 && !comments.trim()) {
      toast.error("Өөрчлөлт оруулах эсвэл тайлбар бичих шаардлагатай");
      return;
    }
    await submitReview("changes_requested");
  };

  const submitReview = async (
    status: "approved" | "rejected" | "changes_requested"
  ) => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();

      // Одоогийн хэрэглэгчийг авах
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Хэрэглэгч олдсонгүй");
      }

      // 1. Шалгуулагчийн статусыг шинэчлэх
      const { data: reviewer } = await supabase
        .from("order_reviewers")
        .select("id")
        .eq("order_id", order.id)
        .eq("user_id", user.id)
        .single();

      if (!reviewer) {
        throw new Error("Шалгуулагчийн мэдээлэл олдсонгүй");
      }

      const { error: reviewerError } = await supabase
        .from("order_reviewers")
        .update({
          status: status,
          comments: comments,
          completed_at: new Date().toISOString(),
        })
        .eq("id", reviewer.id);

      if (reviewerError) {
        throw new Error(reviewerError.message);
      }

      // 2. Өөрчлөлтүүдийг хэрэгжүүлэх (зөвхөн баталгаажсан эсвэл өөрчлөлт шаардсан тохиолдолд)
      if (status === "approved" || status === "changes_requested") {
        for (const [itemId, change] of Object.entries(changes)) {
          const { error: updateError } = await supabase
            .from("order_items")
            .update({
              quantity: change.quantity,
              notes: change.notes,
            })
            .eq("id", itemId)
            .eq("order_id", order.id);

          if (updateError) {
            console.error(`Сэлбэг ${itemId} шинэчлэхэд алдаа:`, updateError);
          }
        }
      }

      // 3. Өөрчлөлтийн түүх хадгалах
      const { error: revisionError } = await supabase
        .from("order_revisions")
        .insert({
          order_id: order.id,
          changed_by: user.id,
          change_type: status,
          changes_summary: `Шалгуулагчийн ${status} үйлдэл`,
          old_data: { items: orderItems, comments: "" },
          new_data: {
            items: orderItems.map((item) => ({
              ...item,
              quantity: changes[item.id]?.quantity || item.quantity,
              notes: changes[item.id]?.notes || item.notes,
            })),
            comments,
          },
        });

      if (revisionError) {
        console.error("Өөрчлөлтийн түүх хадгалахад алдаа:", revisionError);
      }

      // 4. Захиалгын статусыг шинэчлэх
      if (status === "approved") {
        // Бүх шалгуулагчид баталгажуулсан эсэхийг шалгах
        await checkAllReviewersApproved(order.id);
      } else if (status === "rejected") {
        await supabase
          .from("orders")
          .update({ status: "rejected" })
          .eq("id", order.id);
      }

      toast.success(`Үйлдэл амжилттай: ${getStatusLabel(status)}`);
      onReviewComplete();
      router.push("/dashboard/review-requests");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkAllReviewersApproved = async (orderId: number) => {
    const supabase = createClient();

    const { data: reviewers, error } = await supabase
      .from("order_reviewers")
      .select("status")
      .eq("order_id", orderId)
      .eq("reviewer_type", "in_reviewer");

    if (error) {
      console.error("Шалгуулагчдын мэдээлэл авахад алдаа:", error);
      return;
    }

    // Бүх шалгуулагчид баталгажуулсан эсэхийг шалгах
    const allApproved = reviewers.every(
      (reviewer) => reviewer.status === "approved"
    );

    if (allApproved) {
      // Дараагийн шатны хүнд шилжих
      await supabase
        .from("orders")
        .update({ status: "pending_department_approval" })
        .eq("id", orderId);

      // Дараагийн шатны хүнд мэдэгдэл илгээх
      await notifyNextApprover(orderId);
    }
  };

  const notifyNextApprover = async (orderId: number) => {
    const supabase = createClient();

    // Дараагийн шатны шалгуулагчдад мэдэгдэл илгээх
    // Энэ хэсэгт имэйл/мессеж илгээх логик нэмж болно
    console.log("Дараагийн шатны хүнд мэдэгдэл илгээх:", orderId);
  };

  const getStatusLabel = (status: string) => {
    const statusLabels = {
      approved: "Зөвшөөрсөн",
      rejected: "Татгалзсан",
      changes_requested: "Өөрчлөлт шаардсан",
    };
    return statusLabels[status as keyof typeof statusLabels] || status;
  };

  return (
    <div className="space-y-6">
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
              <Label className="text-gray-600">Хүсэлт гаргасан</Label>
              <p>{order.users.nice_name}</p>
              <p className="text-sm text-gray-600">
                {order.users.department_name}
              </p>
            </div>
            {order.description && (
              <div className="md:col-span-2">
                <Label className="text-gray-600">Тайлбар</Label>
                <p className="mt-1">{order.description}</p>
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
            {orderItems.map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
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
                      <input
                        type="number"
                        min="1"
                        value={changes[item.id]?.quantity || item.quantity}
                        onChange={(e) =>
                          handleQuantityChange(
                            item.id,
                            parseInt(e.target.value) || 1
                          )
                        }
                        className="border rounded px-3 py-2 w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">
                        (Анхны: {item.quantity})
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-600">Тайлбар</Label>
                    <textarea
                      value={changes[item.id]?.notes || item.notes || ""}
                      onChange={(e) =>
                        handleNotesChange(item.id, e.target.value)
                      }
                      className="w-full border rounded px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Тайлбар оруулах..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Шалгуулалтын үйлдлүүд */}
      <Card>
        <CardHeader>
          <CardTitle>Шалгуулалтын үйлдлүүд</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="comments" className="text-gray-600">
              Тайлбар
            </Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Шалгуулалтын тайлбар, санал зөвлөмж..."
              rows={4}
              className="mt-1"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 flex-1"
            >
              {isSubmitting ? "Түр хүлээнэ үү..." : "Зөвшөөрөх"}
            </Button>

            <Button
              onClick={handleRequestChanges}
              disabled={isSubmitting}
              variant="outline"
              className="border-yellow-500 text-yellow-700 hover:bg-yellow-50 flex-1"
            >
              {isSubmitting ? "Түр хүлээнэ үү..." : "Өөрчлөлт шаардах"}
            </Button>

            <Button
              onClick={handleReject}
              disabled={isSubmitting}
              variant="destructive"
              className="flex-1"
            >
              {isSubmitting ? "Түр хүлээнэ үү..." : "Татгалзах"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
