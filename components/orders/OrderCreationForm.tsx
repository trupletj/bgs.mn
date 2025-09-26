"use client";

import { useState, useEffect, useCallback } from "react";
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
  ClockIcon,
  PlusIcon,
  TrashIcon,
  PackageIcon,
  FileTextIcon,
  InfoIcon,
  CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  createOrder,
  addOrderItem,
  type PartsCatalog,
  addTechnicalReviewers,
  deleteImagesFromStorage,
} from "@/actions/orders";
import { TechnicalReviewerSelector } from "../reviewer-selector";
import ImageUploader from "../image-uploader";
import ImageViewer from "../image-viewer";
import { OrderFormData, OrderItemForm, UNIT_OPTIONS, UnitType } from "@/types";

export function OrderCreationForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PartsCatalog[]>([]);
  // const [categories, setCategories] = useState<string[]>([]);
  // const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTechnicalReviewers, setSelectedTechnicalReviewers] = useState<
    string[]
  >([]);

  const [pendingImageDeletions, setPendingImageDeletions] = useState<string[]>(
    []
  );
  const [uploadedImages, setUploadedImages] = useState<Record<number, string>>(
    {}
  );

  const [formData, setFormData] = useState<OrderFormData>({
    title: "",
    description: "",
    order_type: "",
    // equipment_name: "",
    // equipment_model: "",
    // equipment_serial: "",
    // equipment_location: "",
    urgency_level: "medium",
    requested_delivery_date: "",
    notes: "",
  });

  const [orderItems, setOrderItems] = useState<OrderItemForm[]>([
    {
      part_name: "",
      quantity: 1,
      unit: "piece",
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
    // Get current user
    // Load categories
    // const loadCategories = async () => {
    //   try {
    //     const { data, error } = await getPartsCategories();
    //     console.log("Categories data:", data, "Error:", error);
    //     if (data) setCategories(data);
    //   } catch (err) {
    //     console.error("Error loading categories:", err);
    //   }
    // };
    // loadCategories();

    // Set loading to false after initial load
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
    value: string | number | undefined
  ) => {
    setOrderItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          // Quantity-г бутархай тоо болгон хувиргах
          if (field === "quantity" && typeof value === "string") {
            // Бутархай тоог зөвшөөрөх (0.5, 1.25, 2.75 гэх мэт)
            const numericValue = parseFloat(value);
            return { ...item, [field]: isNaN(numericValue) ? 0 : numericValue };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const addNewItem = () => {
    setOrderItems((prev) => [
      ...prev,
      {
        part_name: "",
        quantity: 1,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // const searchParts = async () => {
  //   if (!searchQuery.trim()) return;

  //   const categoryFilter =
  //     selectedCategory === "all" ? undefined : selectedCategory;
  //   const { data, error } = await searchPartsCatalog(
  //     searchQuery,
  //     categoryFilter
  //   );
  //   if (error) {
  //     toast.error("Failed to search parts: " + error.message);
  //   } else {
  //     setSearchResults(data);
  //   }
  // };

  // const selectPart = (part: PartsCatalog, itemIndex: number) => {
  //   handleItemChange(itemIndex, "part_id", part.id);
  //   handleItemChange(itemIndex, "part_number", part.part_number);
  //   handleItemChange(itemIndex, "part_name", part.name);
  //   handleItemChange(itemIndex, "part_description", part.description);
  //   handleItemChange(itemIndex, "manufacturer", part.manufacturer);
  //   setSearchResults([]);
  //   setSearchQuery("");
  // };

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!formData.title.trim()) {
      toast.error("Захиалгын гарчиг оруулах шаардлагатай.");
      return;
    }

    if (orderItems.some((item) => !item.part_name.trim())) {
      toast.error("Бүх сэлбэгүүд нэртэй байх ёстой.");
      return;
    }

    if (!isDraft && selectedTechnicalReviewers.length === 0) {
      toast.error("Хамгийн багадаа 1 хянагч сонгоно уу");
      return;
    }

    setLoading(true);

    try {
      // Create order
      const { data: order, error: orderError } = await createOrder({
        title: formData.title,
        description: formData.description,
        order_type: formData.order_type,
        // equipment_name: formData.equipment_name,
        // equipment_model: formData.equipment_model,
        // equipment_serial: formData.equipment_serial,
        // equipment_location: formData.equipment_location,
        urgency_level: formData.urgency_level,
        requested_delivery_date: formData.requested_delivery_date || undefined,
        notes: formData.notes,
        status: isDraft ? "draft" : "pending_technical_review",
      });

      if (orderError || !order) {
        throw new Error(
          orderError?.message || "Захиалга үүсгэхэд алдаа гарлаа"
        );
      }

      // 2. Сэлбэгүүд нэмэх (зургийн URL-г оруулах)
      for (const [index, item] of orderItems.entries()) {
        const imageUrl = uploadedImages[index];

        const { data: itemData, error: itemError } = await addOrderItem({
          order_id: order.id,
          part_number: item.part_number,
          part_name: item.part_name,
          part_description: item.part_description,
          manufacturer: item.manufacturer,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
          image_url: imageUrl || "", // Зургийн URL-г оруулах
        });

        if (itemError) {
          throw new Error(`Сэлбэг нэмэхэд алдаа гарлаа: ${itemError.message}`);
        }
      }

      // 3. Устгахаар тэмдэглэгдсэн зургийг устгах
      if (pendingImageDeletions.length > 0) {
        await deleteImagesFromStorage(pendingImageDeletions);
      }

      if (!isDraft) {
        await addTechnicalReviewers(
          order.id.toString(),
          selectedTechnicalReviewers
        );
      }

      toast.success(
        `Захиалга #${order.order_number} амжилттай үүслээ${
          isDraft ? " (Ноорог)" : " хяналтад илгээгдлээ"
        }`
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

  // Show authentication required message if no user
  // if (!user) {
  //   return (
  //     <div className="max-w-6xl mx-auto space-y-8">
  //       <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
  //         <div className="flex flex-col items-center space-y-4">
  //           <div className="bg-yellow-100 rounded-full p-3">
  //             <InfoIcon className="h-8 w-8 text-yellow-600" />
  //           </div>
  //           <div>
  //             <h3 className="text-lg font-semibold text-yellow-800">
  //               Authentication Required
  //             </h3>
  //             <p className="text-yellow-700 mt-2">
  //               You need to be logged in to create an order. Please sign in with
  //               your phone number.
  //             </p>
  //             <p className="text-sm text-yellow-600 mt-1">
  //               For testing: Use register number + phone &ldquo;99135213&rdquo;
  //             </p>
  //           </div>
  //           <div className="flex space-x-3">
  //             <Button
  //               onClick={() => router.push("/")}
  //               variant="outline"
  //               className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
  //             >
  //               Go to Login
  //             </Button>
  //             <Button
  //               onClick={() => router.refresh()}
  //               className="bg-yellow-600 hover:bg-yellow-700 text-white"
  //             >
  //               Refresh Page
  //             </Button>
  //             <Button
  //               onClick={() => {
  //                 // Temporary test mode - simulate user for testing
  //                 setUser({ id: "2f04b895-e3f2-4b10-af5e-444a1ef9c366" } as {
  //                   id: string;
  //                 });
  //                 toast.info("Test mode activated - Using test user");
  //               }}
  //               className="bg-blue-600 hover:bg-blue-700 text-white"
  //             >
  //               Test Mode (Dev Only)
  //             </Button>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Progress Indicator */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <PackageIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Тоног төхөөрөмжийн эд ангиудын захиалга үүсгэх
            </h2>
            <p className="text-gray-600">
              Доорх дэлгэрэнгүй мэдээллийг бөглөж эд ангиудын хүсэлтээ үүсгэнэ
              үү
            </p>
          </div>
        </div>
      </div>

      {/* Захиалгын мэдээлэл */}
      <Card className="shadow-sm border-0 ring-1 ring-gray-200">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200">
          <CardTitle className="flex items-center space-x-2">
            <InfoIcon className="h-5 w-5 text-indigo-600" />
            <span>Захиалгын мэдээлэл</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="title"
                className="text-sm font-medium text-gray-700"
              >
                Захиалгын гарчиг <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Жишээ нь: Тоормосны системийн засвар үйлчилгээний сэлбэгүүд"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="title"
                className="text-sm font-medium text-gray-700"
              >
                Захиалгын төрөл <span className="text-red-500">*</span>
              </Label>
              <Input
                id="order_type"
                value={formData.order_type}
                onChange={(e) =>
                  handleInputChange("order_type", e.target.value)
                }
                placeholder="Хангамжийн бараа материал"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="urgency"
                className="text-sm font-medium text-gray-700"
              >
                Яаралтай байдлын түвшин
              </Label>
              <Select
                value={formData.urgency_level}
                onValueChange={(
                  value: "low" | "medium" | "high" | "critical"
                ) => handleInputChange("urgency_level", value)}
              >
                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="flex items-center">
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800 mr-2"
                    >
                      Бага
                    </Badge>
                  </SelectItem>
                  <SelectItem value="medium" className="flex items-center">
                    <Badge
                      variant="secondary"
                      className="bg-yellow-100 text-yellow-800 mr-2"
                    >
                      Дунд
                    </Badge>
                  </SelectItem>
                  <SelectItem value="high" className="flex items-center">
                    <Badge
                      variant="secondary"
                      className="bg-orange-100 text-orange-800 mr-2"
                    >
                      Яаралтай
                    </Badge>
                  </SelectItem>
                  <SelectItem value="critical" className="flex items-center">
                    <Badge
                      variant="secondary"
                      className="bg-red-100 text-red-800 mr-2"
                    >
                      Нэн яаралтай
                    </Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="text-sm font-medium text-gray-700"
            >
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

          <div className="space-y-2">
            <Label
              htmlFor="delivery_date"
              className="text-sm font-medium text-gray-700 flex items-center space-x-2"
            >
              <CalendarIcon className="h-4 w-4" />
              <span>Бараа бүтээгдэхүүний хэрэгцээт хязгаар огноо</span>
            </Label>
            <Input
              id="delivery_date"
              type="date"
              value={formData.requested_delivery_date}
              onChange={(e) =>
                handleInputChange("requested_delivery_date", e.target.value)
              }
              className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Equipment Information */}
      {/* Div-г card-р солих */}
      <div className="shadow-sm border-0 ring-1 ring-gray-200">
        {/* <CardHeader className="bg-gray-50/50 border-b border-gray-200">
          <CardTitle className="flex items-center space-x-2">
            <SettingsIcon className="h-5 w-5 text-indigo-600" />
            <span>Equipment Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="equipment_name"
                className="text-sm font-medium text-gray-700"
              >
                Equipment Name
              </Label>
              <Input
                id="equipment_name"
                value={formData.equipment_name}
                onChange={(e) =>
                  handleInputChange("equipment_name", e.target.value)
                }
                placeholder="e.g., Excavator, Truck, Generator"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="equipment_model"
                className="text-sm font-medium text-gray-700"
              >
                Model
              </Label>
              <Input
                id="equipment_model"
                value={formData.equipment_model}
                onChange={(e) =>
                  handleInputChange("equipment_model", e.target.value)
                }
                placeholder="e.g., CAT 320D, Volvo FH16"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="equipment_serial"
                className="text-sm font-medium text-gray-700"
              >
                Serial Number
              </Label>
              <Input
                id="equipment_serial"
                value={formData.equipment_serial}
                onChange={(e) =>
                  handleInputChange("equipment_serial", e.target.value)
                }
                placeholder="Equipment serial number"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="equipment_location"
                className="text-sm font-medium text-gray-700"
              >
                Location
              </Label>
              <Input
                id="equipment_location"
                value={formData.equipment_location}
                onChange={(e) =>
                  handleInputChange("equipment_location", e.target.value)
                }
                placeholder="e.g., Mine Site A, Workshop 2"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent> */}
      </div>

      {/* Parts Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Шаардлагатай сэлбэг, эд ангиуд
            <Button type="button" onClick={addNewItem} size="sm">
              <PlusIcon className="h-4 w-4 mr-2" />
              Сэлбэг нэмэх
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Parts Search */}
          {/* <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search parts catalog..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchParts()}
              />
            </div>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={searchParts}>
              <SearchIcon className="h-4 w-4" />
            </Button>
          </div> */}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
              {/* <h4 className="font-medium mb-2">Search Results:</h4> */}
              {/* <div className="space-y-2">
                {searchResults.map((part) => (
                  <div
                    key={part.id}
                    className="flex items-center justify-between p-2 bg-white rounded border"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{part.name}</div>
                      <div className="text-sm text-gray-600">
                        {part.part_number} • {part.manufacturer} • ₮
                        {part.unit_price?.toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {orderItems.map((_, index) => (
                        <Button
                          key={index}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => selectPart(part, index)}
                        >
                          Add to Item {index + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div> */}
            </div>
          )}

          {/* Order Items */}
          <div className="space-y-6">
            {orderItems.map((item, index) => (
              <div
                key={index}
                className="border rounded-xl p-6 bg-gray-50 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold">Сэлбэг {index + 1}</h4>
                  {orderItems.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Сэлбэгийн нэр */}
                  <div>
                    <Label className="mb-1 block">Сэлбэгийн нэр *</Label>
                    <Input
                      value={item.part_name}
                      onChange={(e) =>
                        handleItemChange(index, "part_name", e.target.value)
                      }
                      placeholder="Сэлбэгийн нэр эсвэл тайлбар"
                    />
                  </div>

                  {/* Эдийн дугаар */}
                  <div>
                    <Label className="mb-1 block">Эдийн дугаар</Label>
                    <Input
                      value={item.part_number || ""}
                      onChange={(e) =>
                        handleItemChange(index, "part_number", e.target.value)
                      }
                      placeholder="Үйлдвэрийн эдийн дугаар"
                    />
                  </div>

                  {/* Үйлдвэрлэгч */}
                  <div>
                    <Label className="mb-1 block">Үйлдвэрлэгч</Label>
                    <Input
                      value={item.manufacturer || ""}
                      onChange={(e) =>
                        handleItemChange(index, "manufacturer", e.target.value)
                      }
                      placeholder="Бренд эсвэл үйлдвэрлэгч"
                    />
                  </div>

                  {/* Тоо ширхэг */}
                  <div>
                    <Label className="mb-1">Тоо хэмжээ *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01" // Бутархай тоо оруулах боломжтой
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, "quantity", e.target.value)
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label className="mb-1">Нэгж *</Label>
                    <Select
                      value={item.unit || "piece"}
                      onValueChange={(value: UnitType) =>
                        handleItemChange(index, "unit", value)
                      }
                    >
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

                  {/* Нэмэлт тайлбар */}
                  <div className="md:col-span-1 lg:col-span-1">
                    <Label className="mb-1 block">Нэмэлт тайлбар</Label>
                    <Textarea
                      value={item.part_description || ""}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          "part_description",
                          e.target.value
                        )
                      }
                      placeholder="Техникийн үзүүлэлт гэх мэт"
                      rows={3}
                    />
                  </div>

                  {/* Зураг оруулах хэсэг */}
                  <div className="md:col-span-2 lg:col-span-3 border-2 border-dashed border-border rounded-lg p-4 bg-white">
                    <ImageUploader
                      multiple={false}
                      onUpload={(url) =>
                        handleImageUpload(
                          index,
                          Array.isArray(url) ? url[0] : url
                        )
                      }
                    />

                    {uploadedImages[index] && (
                      <div className="mt-4">
                        <ImageViewer
                          images={[uploadedImages[index]]}
                          editable
                          onDelete={handleMarkImageForDeletion}
                          pendingDeletion={pendingImageDeletions}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Additional Notes */}
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
              className="text-sm font-medium text-gray-700"
            >
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
            {/* <p className="text-xs text-gray-500">
              Энэ мэдээлэл нь удирдлагууд болон худалдан авах ажиллагааны багт харагдах болно.
            </p> */}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Шалгуулалтын үйл явц</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <TechnicalReviewerSelector
            selectedReviewers={selectedTechnicalReviewers}
            onReviewersChange={setSelectedTechnicalReviewers}
            minimumSelection={2}
            currentStep="first_step"
          />

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
            <h4 className="font-medium text-amber-800 mb-2">
              Шалгуулалтын үйл явц:
            </h4>
            <ol className="text-sm text-amber-700 list-decimal list-inside space-y-1">
              <li>Эхлээд сонгосон хянагчид баталгажуулна</li>
              <li>
                Бүх хянагчид баталгаажуулсны дараа захиалга дараагийн шатанд
                орно
              </li>
            </ol>
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
            className="h-11 px-6 border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Цуцлах
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="h-11 px-6 bg-gray-100 text-gray-800 hover:bg-gray-200"
          >
            {loading ? (
              <>
                <ClockIcon className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save as Draft"
            )}
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={loading || selectedTechnicalReviewers.length <= 1}
            className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {loading ? (
              <>
                <ClockIcon className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Submit for Review"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
