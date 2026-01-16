"use client";

import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { UNIT_OPTIONS } from "@/types";
import ImageViewer from "@/components/image-viewer";
import { OrderWorkflow } from "./order-workflow";
import { getSparePartLabel } from "@/types/types";

interface NewOrderDetailViewProps {
  orderDetails: {
    order: any;
    profile: any;
    items: any[];
    reviewers: any[]; // order_step_reviewers-ийн flat жагсаалт
  };
}

export function NewOrderDetailView({ orderDetails }: NewOrderDetailViewProps) {
  const { order, profile, items, reviewers } = orderDetails;

  const getOrderTypeBadge = (type: string) => {
    const config: Record<string, { label: string; className: string }> = {
      emergency: { label: "Яаралтай", className: "bg-red-100 text-red-800" },
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
      other: { label: "Бусад", className: "bg-blue-100 text-blue-800" },
    };
    const cfg = config[type] || config.other;
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year} он ${month} сар ${day} өдөр`;
  }

  const getStatusBadge = (status?: string) => {
    const map: Record<
      string,
      {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
      }
    > = {
      approved: {
        label: "Батлагдсан",
        variant: "default",
      },
      changes_requested: {
        label: "Өөрчлөлттэй батлагдсан",
        variant: "secondary",
      },
      rejected: {
        label: "Татгалзсан",
        variant: "destructive",
      },
    };

    const s = map[status ?? ""] || {
      label: status ?? "Тодорхойгүйлгүй",
      variant: "outline",
    };

    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <Link href="/orders/list" className="inline-block mb-6">
        <Button variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" /> Буцах
        </Button>
      </Link>

      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">{order.title}</h1>
          {/* <p className="text-muted-foreground">#{order.order_number}</p> */}
        </div>
        {getStatusBadge(order.status)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Захиалгын мэдээлэл */}
          <Card>
            <CardHeader>
              <CardTitle>Захиалгын дэлгэрэнгүй</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.description && <p>{order.description}</p>}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Төрөл:</span>{" "}
                  {getOrderTypeBadge(order.order_type)}
                </div>
                <div>
                  <span className="font-medium">Хүргэлт хүсэгдсэн:</span>{" "}
                  {formatDate(order.requested_delivery_date)}
                </div>
                <div>
                  <span className="font-medium">Үүсгэсэн:</span>{" "}
                  {formatDate(order.created_at)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Сэлбэгүүд */}
          <Card>
            <CardHeader>
              <CardTitle>Сэлбэгүүд ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Нэр</TableHead>
                    <TableHead>Тоо</TableHead>
                    <TableHead>Төрөл</TableHead>
                    <TableHead>Зураг</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.part_name}</div>
                          {item.part_number && (
                            <div className="text-sm text-muted-foreground">
                              {item.part_number}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {/* <TableCell>
                        <Badge variant="outline">
                          {item.quantity}{" "}
                          {UNIT_OPTIONS.find((u) => u.value === item.unit)
                            ?.label || item.unit}
                        </Badge>
                      </TableCell> */}
                      <TableCell>
                        {order.status === "approved" ||
                        order.status === "changes_requested" ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="default">
                              Батлагдсан: {item.final_quantity ?? item.quantity}
                            </Badge>

                            {item.final_quantity !== item.quantity && (
                              <span className="text-xs text-muted-foreground ml-2">
                                Анх захиалсан: {item.quantity}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline">{item.quantity}</Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        {getSparePartLabel(item.spare_type)}
                      </TableCell>
                      <TableCell>
                        {item.image_url ? (
                          <ImageViewer images={[item.image_url]} />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Шинэ workflow timeline */}
          <OrderWorkflow reviewers={reviewers} items={items} />
        </div>

        {/* Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Хүсэлт гаргагч
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">
                  {profile.name || "Нэр байхгүй"}
                </p>
                {profile.position_name && (
                  <p className="text-sm text-muted-foreground">
                    {profile.position_name}
                  </p>
                )}
                {profile.department_name && (
                  <p className="text-sm text-muted-foreground">
                    {profile.department_name}
                  </p>
                )}
                {profile.phone && (
                  <p className="text-sm text-muted-foreground">
                    {profile.phone}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
