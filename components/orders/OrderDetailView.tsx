"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Package,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Order, OrderItem, OrderReviewers } from "@/actions/orders";
import { SPARE_PART_OPTIONS, UNIT_OPTIONS } from "@/types/types";
import ImageViewer from "../image-viewer";
import { OrderWorkflowTimeline } from "./order-workflow-timeline";
import { Label } from "../ui/label";

interface OrderDetailViewProps {
  orderDetails: {
    order: Order;
    items: OrderItem[];
    order_reviewers: OrderReviewers[];
    profile: {
      id: string;
      name?: string;
      department_name?: string;
      phone?: string;
    };
  };
}

export function OrderDetailView({ orderDetails }: OrderDetailViewProps) {
  const { order, items, profile, order_reviewers } = orderDetails;

  const getOrderTypeBadge = (orderType: string) => {
    const typeConfig = {
      emergency: {
        label: "Яаралтай",
        className: "bg-red-100 text-red-800",
      },
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
      other: {
        label: "Бусад",
        className: "bg-blue-100 text-blue-800",
      },
    };

    const config =
      typeConfig[orderType as keyof typeof typeConfig] || typeConfig.other;

    return <Badge className={config.className}>{config.label}</Badge>;
  };
  const formatStatus = (status: string) => {
    const statusTranslations: { [key: string]: string } = {
      rejected: "Татгалзсан",
      changed_requested: "Утга өөрчлөгдсөн",
      approved: "Батлагдсан",
    };

    return (
      statusTranslations[status] ||
      status
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <Link href="/orders" className="inline-block mb-6">
          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Буцах
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-2">
                {order.title}
              </h1>
            </div>
            <Badge
              variant={getStatusBadgeVariant(order.status)}
              className="w-fit text-base px-4 py-2">
              {formatStatus(order.status)}
            </Badge>
          </div>
        </div>

        {/* Main grid layout */}
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Details Card */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="border-b border-slate-200 dark:border-slate-800">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-lg">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span>Захиалгын дэлгэрэнгүй</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Тайлбар
                    </h4>
                    {order.description ? (
                      <p className="text-slate-900 dark:text-slate-100 leading-relaxed">
                        {order.description}
                      </p>
                    ) : (
                      <p className="text-slate-500 italic">Тайлбар байхгүй</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Тэмдэглээ
                    </h4>
                    {order.notes ? (
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                        {order.notes}
                      </p>
                    ) : (
                      <p className="text-slate-500 italic text-sm">
                        Тэмдэглээ байхгүй
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Requested Date */}
                    {order.requested_delivery_date && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-slate-500" />
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                            Шаардлагатай огноо
                          </p>
                        </div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {formatDateCustom(order.requested_delivery_date)}
                        </p>
                      </div>
                    )}

                    {/* Created Date */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-slate-500" />
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                          Үүсгэсэн
                        </p>
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {formatDateCustom(order.created_at)}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                        Захиалгын төрөл
                      </Label>
                      <div className="w-fit text-xs mt-1">
                        {getOrderTypeBadge(order.order_type)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Items Card */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-950 rounded-lg">
                    <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle>Захиалгын бараа</CardTitle>
                    <CardDescription className="mt-1">
                      {items.length}{" "}
                      {items.length === 1 ? "эд анги" : "эд анги"} - Энэ
                      захиалгад хүссэн сэлбэгүүд
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                          <TableHead className="text-slate-700 dark:text-slate-300 font-semibold">
                            Сэлбэг, эд анги
                          </TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300 font-semibold">
                            Тоо
                          </TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300 font-semibold">
                            Сэлбэгийн төрөл
                          </TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300 font-semibold">
                            Зураг
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow
                            key={item.id}
                            className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                            <TableCell className="text-wrap">
                              <div className="space-y-1">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {item.part_name}
                                </div>
                                {item.part_number && (
                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                    <span className="font-medium">Дугаар:</span>{" "}
                                    {item.part_number}
                                  </div>
                                )}
                                {item.manufacturer && (
                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                    <span className="font-medium">
                                      Үйлдвэрлэгч:
                                    </span>{" "}
                                    {item.manufacturer}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.quantity}{" "}
                                {UNIT_OPTIONS.find((u) => u.value === item.unit)
                                  ?.label || item.unit}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {SPARE_PART_OPTIONS.find(
                                  (u) => u.value === item.spare_type
                                )?.label || item.spare_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {item.image_url ? (
                                <ImageViewer images={[item.image_url]} />
                              ) : (
                                <span className="text-slate-500 text-sm italic">
                                  Зураггүй
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="text-slate-600 dark:text-slate-400">
                      Энэ захиалгад ямар ч эд анги, сэлбэг байхгүй байна.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Workflow Timeline */}
            <OrderWorkflowTimeline reviewers={order_reviewers} items={items} />
          </div>

          {/* Sidebar - Order Information */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Requester Card */}
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm sticky top-4">
                <CardHeader className="border-b border-slate-200 dark:border-slate-800">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 bg-purple-100 dark:bg-purple-950 rounded-lg">
                      <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span>Хүсэлт гаргагч</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Нэр
                    </p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {profile.name || "Мэдээллийн абоонь байхгүй"}
                    </p>
                  </div>

                  {profile.department_name && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Хэлтэс
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        {profile.department_name}
                      </p>
                    </div>
                  )}

                  {profile.phone && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Утас
                      </p>
                      <p className="text-slate-700 dark:text-slate-300 font-mono text-sm">
                        {profile.phone}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Stats Card */}
              {/* <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="border-b border-slate-200 dark:border-slate-800">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Статистик
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900 rounded">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Бараа
                    </span>
                    <Badge variant="outline">{items.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900 rounded">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Баталгаажуулагчид
                    </span>
                    <Badge variant="outline">{order_reviewers.length}</Badge>
                  </div>
                </CardContent>
              </Card> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Helper functions
  function getStatusBadgeVariant(status: string) {
    switch (status?.toLowerCase()) {
      case "pending_review":
        return "outline" as const;
      case "approved":
        return "default" as const;
      case "rejected":
        return "destructive" as const;
      case "changes_requested":
        return "default" as const;
      case "completed":
        return "default" as const;
      default:
        return "secondary" as const;
    }
  }

  function getUrgencyBadgeVariant(urgency: string) {
    switch (urgency.toLowerCase()) {
      case "critical":
      case "high":
        return "destructive" as const;
      case "medium":
        return "default" as const;
      case "low":
        return "secondary" as const;
      default:
        return "secondary" as const;
    }
  }

  function getUrgencyIcon(urgency: string) {
    switch (urgency.toLowerCase()) {
      case "critical":
      case "high":
        return (
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        );
      case "medium":
        return (
          <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        );
      case "low":
        return (
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        );
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  }

  function formatDateCustom(dateString: string) {
    const date = new Date(dateString);

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year} оны ${month} сарын ${day} өдөр`;
  }
}
