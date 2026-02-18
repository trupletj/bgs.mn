"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CalendarIcon, ClockIcon, SearchIcon } from "lucide-react";
import { type Order } from "@/actions/orders";

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  pending_review: "bg-yellow-100 text-yellow-800",
  in_review: "bg-blue-100 text-blue-800",
  pending_approval: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  final_approved: "bg-emerald-100 text-emerald-800",
  in_procurement: "bg-purple-100 text-purple-800",
  completed: "bg-slate-100 text-slate-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

interface Props {
  orders: Order[];
}

export function OrdersList({ orders }: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchQuery ||
      order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  function formatDateCustom(dateString: string) {
    const date = new Date(dateString);

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year} оны ${month} сарын ${day} өдөр`;
  }

  const formatStatus = (status: string) => {
    const statusTranslations: { [key: string]: string } = {
      rejected: "Татгалзсан",
      changes_requested: "Өөрчлөлттэй батлагдсан",
      approved: "Батлагдсан",
      created_step: "Хянагдаж байна",
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Захиалгыг шүүх</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Хайлт хийх ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-6">
            <p className="text-gray-500 text-lg">Илэрц олдсонгүй</p>
            <p className="text-gray-400 mt-2">
              {orders.length === 0
                ? "Ямарч захиалга үүсгээгүй байна."
                : "Шүүлтүүрийн тохиргоог өөрчилж дахин оролдоно уу."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-lg font-semibold text-blue-600 hover:text-blue-800">
                        {order.title}
                      </Link>
                      <Badge
                        className={
                          statusColors[
                            order.status as keyof typeof statusColors
                          ] || statusColors.draft
                        }>
                        {formatStatus(order.status)}
                      </Badge>
                    </div>
                    {order.description && (
                      <p className="text-gray-700 mb-3 line-clamp-2">
                        {order.description}
                      </p>
                    )}

                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        Үүсгэсэн огноо: {formatDateCustom(order.created_at)}
                      </div>
                      {order.requested_delivery_date && (
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          Шаардлагатай огноо:{" "}
                          {formatDateCustom(order.requested_delivery_date)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <Link href={`/orders/${order.id}`}>
                      <Button variant="outline" size="sm" className="mt-2">
                        Захиалгын мэдээллийг харах
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
