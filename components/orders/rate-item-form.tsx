// components/orders/rate-item-form.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { submitReview } from "@/actions/rate";
import ImageViewer from "@/components/image-viewer";
import { OrderItem, OrderStep, SubOrderItem } from "@/types/rate";
import { UNIT_OPTIONS } from "@/types";
import { UnitSpareDisplay } from "../unit-display";
import { createClient } from "@/utils/supabase/client";
import { SubOrderHistoryPopover } from "./sub-order-history-pop";

interface RateItemFormProps {
  orderItems: OrderItem[];
  currentStep: OrderStep;
  order_instance_id: number;
  reviewer_profile_id: number;
}

export function RateItemForm({
  orderItems,
  currentStep,
  order_instance_id,
  reviewer_profile_id,
}: RateItemFormProps) {
  const [comments, setComments] = useState("");
  const [newQuantities, setNewQuantities] = useState<Record<number, number>>(
    {},
  );
  const [itemComments, setItemComments] = useState<Record<number, string>>({});
  const [subOrderItems, setSubOrderItems] = useState<
    Record<number, SubOrderItem[]>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const hasChanges = Object.keys(newQuantities).length > 0;

  const handleItemCommentChange = (itemId: number, value: string) => {
    setItemComments((prev) => ({ ...prev, [itemId]: value }));
  };
  useEffect(() => {
    loadSubOrderItems();
  }, [orderItems]);

  const loadSubOrderItems = async () => {
    try {
      const itemIds = orderItems.map((item) => item.id);

      const { data, error } = await supabase
        .from("sub_order_item")
        .select(
          `id, 
          order_item_id, 
          quantity, 
          status, 
          description, 
          created_at, 
          created_by, 
          reviewer_profile:profile!sub_order_item_reviewer_profile_id_fkey( name, position_name )`,
        )
        .in("order_item_id", itemIds)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Group by order_item_id
      const grouped: Record<number, SubOrderItem[]> = {};
      data?.forEach((item) => {
        if (!grouped[item.order_item_id]) {
          grouped[item.order_item_id] = [];
        }
        grouped[item.order_item_id].push(item as unknown as SubOrderItem);
      });

      setSubOrderItems(grouped);
    } catch (error) {
      console.error("Error loading sub order items:", error);
    } finally {
    }
  };

  const handleQuantityChange = (itemId: number, value: string) => {
    const num = parseFloat(value) || 0;
    const original = orderItems.find((i) => i.id === itemId)?.quantity || 0;

    setNewQuantities((prev) => {
      if (num === original) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: num };
    });
  };

  const handleSubmit = async (
    status: "approved" | "rejected" | "changes_requested",
  ) => {
    setIsSubmitting(true);

    const result = await submitReview({
      order_instance_id,
      order_step_id: currentStep.id,
      status,
      comments: comments.trim(),
      newQuantities: status === "changes_requested" ? newQuantities : undefined,
      reviewer_profile_id,
      itemComments: status === "changes_requested" ? itemComments : undefined,
    });

    if (result.success) {
      toast.success(
        status === "approved"
          ? "Зөвшөөрлөө"
          : status === "rejected"
            ? "Татгалзлаа"
            : "Өөрчлөлт шаардлаа",
      );
      router.push("/orders/list");
    } else {
      toast.error(result.error || "Алдаа гарлаа");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8">
      {/* Сэлбэгүүд */}
      <Card>
        <CardHeader>
          <CardTitle>Сэлбэгийн жагсаалт</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {orderItems.map((item) => {
            const changed = newQuantities[item.id];
            const isChanged =
              changed !== undefined && changed !== item.quantity;

            return (
              <div key={item.id} className="p-5 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div className="lg:col-span-2">
                    <Label>Сэлбэгийн нэр</Label>
                    <p className="font-medium">{item.part_name}</p>
                    {item.part_number && (
                      <p className="text-sm text-gray-600">
                        Дугаар: {item.part_number}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Тоо хэмжээ</Label>
                    <SubOrderHistoryPopover history={subOrderItems[item.id]} />
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={changed ?? item.quantity}
                        onChange={(e) =>
                          handleQuantityChange(item.id, e.target.value)
                        }
                        className="w-32 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </div>
                    {isChanged && (
                      <Badge
                        variant="outline"
                        className="mt-1 bg-yellow-100 text-yellow-800">
                        Хуучин утга:
                        <span className="text-sm font-semibold text-gray-600 line-through">
                          {item.quantity}
                        </span>
                      </Badge>
                    )}
                  </div>

                  <div>
                    <Label>Нэгж</Label>
                    <p className="font-medium mt-1">
                      {UNIT_OPTIONS.find((u) => u.value === item.unit)?.label ||
                        item.unit}
                    </p>
                  </div>

                  <div>
                    <Label>Төрөл</Label>
                    <p className="font-medium mt-1">
                      <UnitSpareDisplay unit={item.spare_type} />
                    </p>
                  </div>

                  <div>
                    <Label>Зураг</Label>
                    <div className="mt-1 min-h-12">
                      {item.image_url ? (
                        <ImageViewer images={[item.image_url]} />
                      ) : (
                        <span className="text-gray-500 text-sm">Байхгүй</span>
                      )}
                    </div>
                  </div>
                </div>

                {(item.part_description || item.notes) && (
                  <div className="mt-4">
                    <Label>Тайлбар</Label>
                    <p className="text-sm bg-white p-3 rounded border mt-1">
                      {item.part_description || item.notes || "-"}
                    </p>
                  </div>
                )}
                <div className="mt-3">
                  <Label
                    className={`text-xs ${isChanged ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
                    {isChanged
                      ? "Өөрчлөлтийн тайлбар (заавал биш)"
                      : "Тоог өөрчилсөн үед тайлбар бичих боломжтой"}
                  </Label>
                  <Textarea
                    placeholder="Энэхүү тоо хэмжээний өөрчлөлтийн шалтгааныг бичнэ үү..."
                    className="mt-1 h-20"
                    value={itemComments[item.id] || ""}
                    onChange={(e) =>
                      handleItemCommentChange(item.id, e.target.value)
                    }
                    disabled={!isChanged || isSubmitting} // Тоо өөрчлөгдөөгүй бол идэвхгүй
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Шийдвэр */}
      <Card>
        <CardHeader>
          <CardTitle>Таны шийдвэр</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Textarea
              placeholder="Санал, шалтгаан, өөрчлөлтийн тайлбар..."
              rows={5}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => handleSubmit("rejected")}
              disabled={isSubmitting}
              variant="destructive"
              className="flex-1">
              {isSubmitting ? "Илгээж байна..." : "Татгалзах"}
            </Button>

            {hasChanges ? (
              <Button
                onClick={() => handleSubmit("changes_requested")}
                disabled={isSubmitting}
                variant="outline"
                className="flex-1 border-yellow-600 text-yellow-700 hover:bg-yellow-50">
                {isSubmitting ? "Илгээж байна..." : "Өөрчлөлт шаардах"}
              </Button>
            ) : (
              <Button
                onClick={() => handleSubmit("approved")}
                disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700">
                {isSubmitting ? "Илгээж байна..." : "Зөвшөөрөх"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
