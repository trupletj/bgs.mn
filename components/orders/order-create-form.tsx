"use client";

import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  PlusIcon,
  TrashIcon,
  FileTextIcon,
  InfoIcon,
  CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteImagesFromStorage,
  createOrderWithItems,
} from "@/actions/orders";
import ImageUploader from "../image-uploader";
import ImageViewer from "../image-viewer";
import {
  OrderItemForm,
  SPARE_PART_OPTIONS,
  SparePartType,
  UNIT_OPTIONS,
  UnitType,
} from "@/types/types";

export interface OrderFormData {
  title: string;
  description: string;
  order_type:
    | "emergency"
    | "service"
    | "major repairs"
    | "safety reserves"
    | "other";
  order_process_id: string;
  urgency_level: "";
  requested_delivery_date: string;
  notes: string;
  status: string;
}

interface OrderProcesses {
  id: string;
  name: string;
}

interface OrderProcessesProps {
  orderProcesses: OrderProcesses[];
}

export function OrderCreateForm({ orderProcesses }: OrderProcessesProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [pendingImageDeletions, setPendingImageDeletions] = useState<string[]>(
    [],
  );
  const [uploadedImages, setUploadedImages] = useState<Record<number, string>>(
    {},
  );

  const [formData, setFormData] = useState<OrderFormData>({
    title: "",
    description: "",
    order_type: "other",
    urgency_level: "",
    requested_delivery_date: "",
    notes: "",
    status: "created_step",
    order_process_id: "",
  });

  const [orderItems, setOrderItems] = useState<OrderItemForm[]>([
    {
      part_name: "",
      quantity: 1,
      unit: "piece",
      spare_type: "other",
      part_number: "",
    },
  ]);

  const handleImageUpload = (itemIndex: number, url: string) => {
    setUploadedImages((prev) => ({
      ...prev,
      [itemIndex]: url,
    }));
  };

  const handleMarkImageForDeletion = (url: string) => {
    setPendingImageDeletions((prev) => [...prev, url]);
  };

  useEffect(() => {
    setTimeout(() => setInitialLoading(false), 100);
  }, []);

  const handleInputChange = (field: keyof OrderFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleItemChange = (
    index: number,
    field: keyof OrderItemForm,
    value: string | number | undefined,
  ) => {
    setOrderItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          if (field === "quantity") {
            if (value === "" || value === undefined) {
              return { ...item, [field]: "" };
            }
            const stringValue = value.toString();
            if (stringValue.endsWith(".")) {
              return { ...item, [field]: stringValue };
            }
            const numericValue = parseFloat(stringValue);
            return {
              ...item,
              [field]: isNaN(numericValue) ? "" : numericValue,
            };
          }

          return { ...item, [field]: value };
        }
        return item;
      }),
    );
  };

  const addNewItem = () => {
    setOrderItems((prev) => [
      ...prev,
      {
        part_name: "",
        quantity: 1,
        unit: "piece",
        spare_type: "other",
        part_number: "",
      },
    ]);
  };

  const getSpareTypeLabel = (value?: string) =>
    SPARE_PART_OPTIONS.find((opt) => opt.value === value)?.label ||
    "Сэлбэгийн төрөл сонгох";

  const isItemDirty = (item: OrderItemForm, index: number) => {
    const hasText =
      Boolean(item.part_name?.trim()) ||
      Boolean(item.part_number?.trim()) ||
      Boolean(item.manufacturer?.trim()) ||
      Boolean(item.part_description?.trim()) ||
      Boolean(item.notes?.trim());

    const hasCustomQuantity =
      item.quantity !== "" &&
      item.quantity !== undefined &&
      Number(item.quantity) !== 1;

    const hasCustomUnit = Boolean(item.unit && item.unit !== "piece");
    const hasCustomSpareType = Boolean(
      item.spare_type && item.spare_type !== "other",
    );
    const hasImage = Boolean(uploadedImages[index]);

    return (
      hasText ||
      hasCustomQuantity ||
      hasCustomUnit ||
      hasCustomSpareType ||
      hasImage
    );
  };

  const removeItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));

      setUploadedImages((prev) => {
        const next: Record<number, string> = {};
        Object.entries(prev).forEach(([key, value]) => {
          const oldIndex = Number(key);
          if (oldIndex < index) next[oldIndex] = value;
          if (oldIndex > index) next[oldIndex - 1] = value;
        });
        return next;
      });
    }
  };

  const handleDeleteItemClick = (index: number) => {
    const item = orderItems[index];

    if (!item) return;

    if (isItemDirty(item, index)) {
      setDeleteIndex(index);
      return;
    }

    removeItem(index);
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!formData.title.trim()) {
      toast.error("Захиалгын гарчиг оруулах шаардлагатай.");
      return;
    }

    if (orderItems.some((item) => !item.part_name.trim())) {
      toast.error("Бүх сэлбэгүүд нэртэй байх ёстой.");
      return;
    }

    if (orderItems.some((item) => !item.part_number.trim())) {
      toast.error("Бүх сэлбэгүүд эдийн дугаартай байх ёстой.");
      return;
    }

    if (!formData.order_process_id) {
      toast.error("Захиалгын процесс сонгоно уу.");
      return;
    }

    setLoading(true);

    try {
      const { data: order, error: orderError } = await createOrderWithItems({
        orderData: {
          title: formData.title,
          description: formData.description,
          order_type: formData.order_type,
          urgency_level: formData.urgency_level,
          requested_delivery_date:
            formData.requested_delivery_date || undefined,
          notes: formData.notes,
          status: formData.status,
          order_process_id: formData.order_process_id,
        },
        items: orderItems.map((item, index) => ({
          part_number: item.part_number,
          part_name: item.part_name,
          part_description: item.part_description,
          manufacturer: item.manufacturer,
          quantity:
            typeof item.quantity === "string"
              ? parseFloat(item.quantity) || 0
              : item.quantity,
          unit: item.unit || "piece",
          notes: item.notes,
          image_url: uploadedImages[index] || "",
          spare_type: item.spare_type,
        })),
      });

      if (orderError || !order) {
        throw new Error(
          orderError?.message || "Захиалга үүсгэхэд алдаа гарлаа",
        );
      }

      if (pendingImageDeletions.length > 0) {
        await deleteImagesFromStorage(pendingImageDeletions);
      }

      toast.success(
        `Захиалга #${order.order_number} амжилттай үүсэж хяналтад илгээгдлээ`,
      );
      router.push(`/orders/${order.id}`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="animate-pulse">
          <div className="bg-gray-200 h-24 rounded-lg mb-6"></div>
          <div className="space-y-6">
            <div className="bg-gray-200 h-48 rounded-lg"></div>
            <div className="bg-gray-200 h-48 rounded-lg"></div>
            <div className="bg-gray-200 h-96 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto space-y-4">
      {/* Захиалгын мэдээлэл */}
      <Card className="shadow-sm border-0 ring-1 ring-gray-200">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200">
          <CardTitle className="flex items-center space-x-2">
            <InfoIcon className="h-5 w-5 text-indigo-600" />
            <span>Захиалгын мэдээлэл</span>
          </CardTitle>
        </CardHeader>
        <CardContent className=" space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="title"
              className="text-sm font-medium text-gray-700">
              Захиалгын гарчиг<span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Жишээ нь: Тоормосны системийн засвар үйлчилгээний сэлбэгүүд"
              className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="min-w-0 space-y-2">
              <Label
                // htmlFor="urgency"
                className="text-sm font-medium text-gray-700">
                Захиалгын төрөл
              </Label>
              <Select
                value={formData.order_type}
                onValueChange={(
                  value:
                    | "emergency"
                    | "service"
                    | "major repairs"
                    | "safety reserves"
                    | "other",
                ) => handleInputChange("order_type", value)}>
                <SelectTrigger className="h-10 w-full border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emergency" className="flex items-center">
                    <Badge
                      variant="secondary"
                      className="bg-red-100 text-red-800 mr-2">
                      Яаралтай
                    </Badge>
                  </SelectItem>
                  <SelectItem value="service" className="flex items-center">
                    <Badge
                      variant="secondary"
                      className="bg-yellow-100 text-yellow-800 mr-2">
                      Үйлчилгээний
                    </Badge>
                  </SelectItem>
                  <SelectItem
                    value="major repairs"
                    className="flex items-center">
                    <Badge
                      variant="secondary"
                      className="bg-orange-100 text-orange-800 mr-2">
                      Их засвар
                    </Badge>
                  </SelectItem>
                  <SelectItem
                    value="safety reserves"
                    className="flex items-center">
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800 mr-2">
                      Аюулгүйн нөөц
                    </Badge>
                  </SelectItem>
                  <SelectItem value="other" className="flex items-center">
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-800 mr-2">
                      Бусад
                    </Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Захиалгын процесс <span className="text-red-500">*</span>
              </Label>

              <Select
                value={formData.order_process_id}
                onValueChange={(value) =>
                  handleInputChange("order_process_id", value)
                }>
                <SelectTrigger className="h-10 w-full border-gray-300">
                  <SelectValue placeholder="Процесс сонгох" />
                </SelectTrigger>

                <SelectContent>
                  {orderProcesses.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Танай хэлтэст тохирсон захиалгын төрөл алга
                    </div>
                  ) : (
                    orderProcesses.map((process) => (
                      <SelectItem key={process.id} value={process.id}>
                        {process.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label
                htmlFor="delivery_date"
                className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                <CalendarIcon className="h-4 w-4" />
                <span>Хэрэгцээт огноо</span>
              </Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.requested_delivery_date}
                onChange={(e) =>
                  handleInputChange("requested_delivery_date", e.target.value)
                }
                className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="text-sm font-medium text-gray-700">
              Тайлбар
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                handleInputChange("description", e.target.value)
              }
              placeholder="Захиалгад тавигдах шаардлагуудын дэлгэрэнгүй..."
              rows={4}
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Parts Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Шаардлагатай сэлбэг, эд ангиуд
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orderItems.map((item, index) => (
              <div
                key={index}
                className="rounded-2xl border bg-white shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center justify-between gap-3 border-b bg-slate-50/70 px-5 py-4">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">
                      Сэлбэг {index + 1}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Нэр, эдийн дугаар, тоо хэмжээ болон шаардлагатай зургийг
                      оруулна.
                    </p>
                  </div>

                  {orderItems.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteItemClick(index)}>
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-6 p-5">
                  {/* Үндсэн мэдээлэл */}
                  <section className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Үндсэн мэдээлэл
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Сэлбэгийн үндсэн мэдээллийг оруулна.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* 1-р мөр: Сэлбэгийн нэр */}
                      <div>
                        <Label className="mb-1 block">
                          Сэлбэгийн нэр <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          value={item.part_name}
                          onChange={(e) =>
                            handleItemChange(index, "part_name", e.target.value)
                          }
                          placeholder="Сэлбэгийн нэр эсвэл тайлбар"
                          required
                        />
                      </div>

                      {/* 2-р мөр: Эдийн дугаар + Үйлдвэрлэгч */}
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label className="mb-1 block">
                            Эдийн дугаар <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={item.part_number || ""}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "part_number",
                                e.target.value,
                              )
                            }
                            placeholder="Үйлдвэрийн эдийн дугаар"
                            required
                          />
                        </div>

                        <div>
                          <Label className="mb-1 block">Үйлдвэрлэгч</Label>
                          <Input
                            value={item.manufacturer || ""}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "manufacturer",
                                e.target.value,
                              )
                            }
                            placeholder="Бренд"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Тоо хэмжээ ба ангилал */}
                  <section className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Тоо хэмжээ ба ангилал
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Захиалах тоо, нэгж болон сэлбэгийн төрлийг сонгоно.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <Label className="mb-1 block">
                          Тоо хэмжээ <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, "quantity", e.target.value)
                          }
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <Label className="mb-1 block">
                          Нэгж <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={item.unit || "piece"}
                          onValueChange={(value: UnitType) =>
                            handleItemChange(index, "unit", value)
                          }>
                          <SelectTrigger>
                            <SelectValue placeholder="Нэгж сонгох" />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map((unit) => (
                              <SelectItem key={unit.value} value={unit.value}>
                                {unit.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-0">
                        <Label className="mb-1 block">
                          Сэлбэгийн төрөл{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={item.spare_type}
                          onValueChange={(value: SparePartType) =>
                            handleItemChange(index, "spare_type", value)
                          }>
                          <SelectTrigger className="h-10 w-full min-w-0 overflow-hidden">
                            <span className="block truncate text-left">
                              {getSpareTypeLabel(item.spare_type)}
                            </span>
                          </SelectTrigger>

                          <SelectContent className="max-w-[360px]">
                            {SPARE_PART_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="min-w-0">
                                <span className="block max-w-[300px] truncate">
                                  {opt.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>

                  {/* Тайлбар + зураг */}
                  <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    <div className="lg:col-span-5">
                      <Label className="mb-1 block">Нэмэлт тайлбар</Label>
                      <Textarea
                        value={item.part_description || ""}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "part_description",
                            e.target.value,
                          )
                        }
                        placeholder="Техникийн үзүүлэлт, зориулалт гэх мэт"
                        rows={5}
                        className="min-h-[132px]"
                      />
                    </div>

                    <div className="lg:col-span-7">
                      <Label className="mb-1 block">Зураг</Label>
                      <div className="rounded-xl border-2 border-dashed border-border bg-slate-50/50 p-4">
                        <ImageUploader
                          multiple={false}
                          hideHelperText={Boolean(uploadedImages[index])}
                          onUpload={(url) =>
                            handleImageUpload(
                              index,
                              Array.isArray(url) ? url[0] : url,
                            )
                          }
                        />

                        {uploadedImages[index] && (
                          <div className="mt-4">
                            <ImageViewer
                              images={[uploadedImages[index]]}
                              editable
                              size="lg"
                              onDelete={handleMarkImageForDeletion}
                              pendingDeletion={pendingImageDeletions}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={addNewItem} size="sm">
              <PlusIcon className="h-4 w-4 mr-2" />
              Сэлбэг нэмэх
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-0 ring-1 ring-gray-200">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200">
          <CardTitle className="flex items-center space-x-2">
            <FileTextIcon className="h-5 w-5 text-green-600" />
            <span>Нэмэлт тэмдэглэл</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6">
          <div className="space-y-2">
            <Label
              htmlFor="notes"
              className="text-sm font-medium text-gray-700">
              Тусгай заавар, хүргэх шаардлага, эсвэл нэмэлт мэдээлэл
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Тусгай заавар, хүргэх шаардлага, ашиг тус эсвэл бусад холбогдох мэдээллийг оруулна уу..."
              className="min-h-[120px] border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
              rows={5}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 -mx-6 -mb-6">
        <div className="flex flex-col sm:flex-row gap-3 justify-end max-w-md ml-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
            className="h-11 px-6 border-gray-300 text-gray-700 hover:bg-gray-50">
            Цуцлах
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit()}
            disabled={loading}
            className={`h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium ${
              loading ? "pointer-events-none opacity-50" : ""
            }`}>
            {loading ? "Захиалга үүсэж байна..." : "Захиалгыг үүсгэх"}
          </Button>
        </div>
      </div>
      <AlertDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteIndex(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Сэлбэг устгахдаа итгэлтэй байна уу?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Энэ сэлбэг дээр оруулсан мэдээлэл устах болно. Энэ үйлдлийг буцаах
              боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleteIndex !== null) {
                  removeItem(deleteIndex);
                  setDeleteIndex(null);
                }
              }}>
              Тийм, устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
