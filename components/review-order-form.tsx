// components/review/review-order-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { submitReview, assignNextReviewers } from "@/actions/review";
import { TechnicalReviewerSelector } from "@/components/reviewer-selector";
import { UnitDisplay } from "@/components/unit-display";
import { UnitType } from "@/types/types";
import { StepType } from "@/utils/workflow";

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
  unit: UnitType;
  part_description?: string;
}

interface ReviewOrderFormProps {
  order: OrderDetails;
  orderItems: OrderItem[];
  onReviewComplete: () => void;
  currentStep: StepType; // currentStep prop нэмэгдлээ
}

export function ReviewOrderForm({
  order,
  orderItems,
  onReviewComplete,
  currentStep, // Шинэ prop
}: ReviewOrderFormProps) {
  const [comments, setComments] = useState("");
  const [newQuantities, setnewQuantities] = useState<Record<string, number>>(
    {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextReviewers, setNextReviewers] = useState<string[]>([]);
  const router = useRouter();

  const hasChanges =
    comments.trim().length > 0 || Object.keys(newQuantities).length > 0;

  const handleQuantityChange = (
    itemId: string,
    newQuantity: number,
    originalQuantity: number
  ) => {
    setnewQuantities((prev) => {
      if (newQuantity === originalQuantity) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      } else {
        return {
          ...prev,
          [itemId]: newQuantity,
        };
      }
    });
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

  const handleReviewAction = async (
    status: "approved" | "rejected" | "changes_requested"
  ) => {
    if (status !== "rejected" && nextReviewers.length === 0) {
      toast.error("Дараагийн шалгуулагчаа сонгоно уу");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitReview({
        order_id: order.id,
        status,
        comments: comments,
        newQuantities,
        currentStep: currentStep,
      });

      if (status === "approved" || status === "changes_requested") {
        await assignNextReviewers({
          order_id: order.id,
          reviewerIds: nextReviewers,
          currentStep: currentStep,
        });

        toast.success(
          status === "approved"
            ? "Захиалга зөвшөөрөгдлөө, дараагийн шалгуулагчдад илгээгдлээ"
            : "Өөрчлөлт шаардлага илгээгдлээ"
        );
      } else {
        toast.success("Захиалгыг татгалзлаа");
      }

      onReviewComplete();
      router.push("/review-request");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    await handleReviewAction("approved");
  };

  const handleReject = async () => {
    if (!comments.trim()) {
      toast.error("Татгалзах шалтгаанаа оруулна уу");
      return;
    }
    await handleReviewAction("rejected");
  };

  const handleRequestChanges = async () => {
    if (!hasChanges) {
      toast.error("Өөрчлөлт оруулах эсвэл тайлбар бичих шаардлагатай");
      return;
    }
    await handleReviewAction("changes_requested");
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Тодорхойгүй";

    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year} оны ${month} сарын ${day}-нд`;
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

      {/* Сэлбэгүүд */}
      <Card>
        <CardHeader>
          <CardTitle>Сэлбэгүүд</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orderItems.map((item) => {
              const changedQuantity = newQuantities[item.id];
              const showChanged =
                changedQuantity !== undefined &&
                changedQuantity !== item.quantity;

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
                      <Label className="text-gray-600">Тоо хэмжээ</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            changedQuantity !== undefined
                              ? changedQuantity
                              : item.quantity
                          }
                          onChange={(e) =>
                            handleQuantityChange(
                              item.id,
                              parseFloat(e.target.value) || 0,
                              item.quantity
                            )
                          }
                          className="border rounded px-3 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {showChanged && (
                          <span className="text-sm text-gray-600 line-through">
                            {item.quantity}
                          </span>
                        )}
                      </div>
                      {showChanged && (
                        <Badge
                          variant="outline"
                          className="mt-1 bg-yellow-100 text-yellow-800">
                          Өөрчлөгдсөн
                        </Badge>
                      )}
                    </div>

                    <div>
                      <Label className="text-gray-600">Нэгж</Label>
                      <p className="font-medium mt-1">
                        <UnitDisplay unit={item.unit} />
                      </p>
                    </div>

                    <div>
                      <Label className="text-gray-600">Тайлбар</Label>
                      <p className="text-sm text-gray-700 mt-1">
                        {item.part_description || "Тайлбаргүй"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Дараагийн шалгуулагч сонгох */}
      <Card>
        <CardHeader>
          <CardTitle>
            {hasChanges
              ? "Дахин шалгуулах хүн сонгох"
              : "Дараагийн баталгаажуулагч сонгох"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TechnicalReviewerSelector
            selectedReviewers={nextReviewers}
            onReviewersChange={setNextReviewers}
            minimumSelection={1}
            currentStep={currentStep} // currentStep-г дамжуулах
          />
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
              onClick={handleReject}
              disabled={isSubmitting}
              variant="destructive"
              className="flex-1">
              {isSubmitting ? "Түр хүлээнэ үү..." : "Татгалзах"}
            </Button>
            {hasChanges ? (
              <Button
                onClick={handleRequestChanges}
                disabled={isSubmitting || nextReviewers.length === 0}
                variant="outline"
                className="border-yellow-500 text-yellow-700 hover:bg-yellow-50 flex-1">
                {isSubmitting ? "Түр хүлээнэ үү..." : "Өөрчлөлт шаардах"}
              </Button>
            ) : (
              <Button
                onClick={handleApprove}
                disabled={isSubmitting || nextReviewers.length === 0}
                className="bg-green-600 hover:bg-green-700 flex-1">
                {isSubmitting ? "Түр хүлээнэ үү..." : "Зөвшөөрөх"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
