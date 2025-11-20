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
import { UnitDisplay, UnitSpareDisplay } from "@/components/unit-display";
import { SparePartType, UnitType } from "@/types/types";
import { StepType } from "@/utils/workflow";
import ImageViewer from "./image-viewer";

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
  spare_type: SparePartType;
  part_description?: string;
  image_url: string | null;
}

interface ReviewOrderFormProps {
  order: OrderDetails;
  orderItems: OrderItem[];
  // onReviewComplete: () => void;
  currentStep: StepType; // currentStep prop нэмэгдлээ
}

export function ReviewOrderForm({
  order,
  orderItems,
  // onReviewComplete,
  currentStep, // Шинэ prop
}: ReviewOrderFormProps) {
  const [comments, setComments] = useState("");
  const [newQuantities, setnewQuantities] = useState<Record<string, number>>(
    {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextReviewers, setNextReviewers] = useState<string[]>([]);
  const router = useRouter();

  const hasChanges = Object.keys(newQuantities).length > 0;

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

  const handleReviewAction = async (
    status: "approved" | "rejected" | "changes_requested"
  ) => {
    if (currentStep !== "fourth_step") {
      if (status !== "rejected" && nextReviewers.length === 0) {
        toast.error("Дараагийн шалгуулагчаа сонгоно уу");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const is_success = await submitReview({
        order_id: order.id,
        status,
        comments: comments,
        newQuantities,
        currentStep: currentStep,
      });
      if (!is_success) {
        toast.success("Захиалгыг амжилттай цуцаллаа.");
        return;
      }
      if (currentStep === "fourth_step" && status !== "rejected") {
        toast.success(
          status === "approved"
            ? "Захиалга зөвшөөрөгдлөө."
            : status === "changes_requested"
            ? "Өөрчлөлт шаардлага илгээгдлээ"
            : "Захиалгыг татгалзлаа"
        );
        router.push("/orders");
        return;
      }

      if (status === "approved" || status === "changes_requested") {
        const is_success = await assignNextReviewers({
          order_id: order.id,
          reviewerIds: nextReviewers,
          currentStep: currentStep,
        });

        if (!is_success.success) {
          toast.error(
            "Өмнөх шалгагч аль хэдийн талгалзсан тул дараагийн шалгуулагч рүү илгээгдсэнгүй."
          );
          router.push("/orders");
        }
        toast.success(
          status === "approved"
            ? "Захиалга зөвшөөрөгдлөө, дараагийн шалгуулагчдад илгээгдлээ"
            : "Өөрчлөлт шаардлага илгээгдлээ"
        );
      } else {
        toast.success("Захиалгыг татгалзлаа");
      }

      // onReviewComplete();
      router.push("/orders");
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

  return (
    <div className="space-y-6">
      {/* Сэлбэгүүд */}
      <Card className="mt-3">
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
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
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
                      <Label className="text-gray-600">Сэлбэгийн төрөл</Label>
                      <p className="font-medium mt-1">
                        <UnitSpareDisplay unit={item.spare_type} />
                      </p>
                    </div>
                    <div>
                      {item.image_url ? (
                        <div className="">
                          <ImageViewer images={[item.image_url]} />
                        </div>
                      ) : (
                        <span>Зураггүй.</span>
                      )}
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
      {currentStep !== "fourth_step" && (
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
      )}

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
                disabled={
                  isSubmitting ||
                  (currentStep !== "fourth_step" && nextReviewers.length === 0)
                }
                variant="outline"
                className="border-yellow-500 text-yellow-700 hover:bg-yellow-50 flex-1">
                {isSubmitting ? "Түр хүлээнэ үү..." : "Өөрчлөлт шаардах"}
              </Button>
            ) : (
              <Button
                onClick={handleApprove}
                disabled={
                  isSubmitting ||
                  (currentStep !== "fourth_step" && nextReviewers.length === 0)
                }
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
