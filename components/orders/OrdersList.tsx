"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Clock,
  Search,
  Package,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { type Order } from "@/actions/orders";

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  draft:             { label: "Ноорог",           className: "bg-slate-100 text-slate-600 border-slate-200" },
  pending:           { label: "Шинэ",             className: "bg-blue-50 text-blue-700 border-blue-200" },
  pending_review:    { label: "Хянагдана",        className: "bg-amber-50 text-amber-700 border-amber-200" },
  in_review:         { label: "Хянагдаж байна",   className: "bg-orange-50 text-orange-700 border-orange-200" },
  created_step:      { label: "Хянагдаж байна",   className: "bg-orange-50 text-orange-700 border-orange-200" },
  approved:          { label: "Батлагдсан",       className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  changes_requested: { label: "Өөрчлөлттэй",     className: "bg-violet-50 text-violet-700 border-violet-200" },
  final_approved:    { label: "Эцэст батлагдсан", className: "bg-green-50 text-green-700 border-green-200" },
  in_procurement:    { label: "Нийлүүлэлт",       className: "bg-purple-50 text-purple-700 border-purple-200" },
  completed:         { label: "Гүйцэтгэсэн",      className: "bg-slate-100 text-slate-600 border-slate-200" },
  rejected:          { label: "Татгалзсан",       className: "bg-red-50 text-red-700 border-red-200" },
  cancelled:         { label: "Цуцлагдсан",       className: "bg-gray-100 text-gray-500 border-gray-200" },
};

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  orders: Order[];
}

export function OrdersList({ orders }: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.title.toLowerCase().includes(q) ||
      order.order_number.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Захиалгын нэр эсвэл дугаараар хайх..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 bg-card pl-10"
        />
      </div>

      {/* Empty state */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Inbox className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground">
            {orders.length === 0 ? "Захиалга байхгүй байна" : "Илэрц олдсонгүй"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {orders.length === 0
              ? "Шинэ захиалга үүсгэхийн тулд дээрх товчийг дарна уу"
              : "Хайлтын утгаа өөрчилж дахин оролдоно уу"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((order) => {
            const status = statusConfig[order.status] ?? {
              label: order.status,
              className: "bg-gray-100 text-gray-600 border-gray-200",
            };

            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
              >
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors group-hover:bg-primary/12">
                  <Package className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground group-hover:text-primary">
                      {order.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`h-5 px-2 text-[11px] font-medium ${status.className}`}
                    >
                      {status.label}
                    </Badge>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono"># {order.order_number}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(order.created_at)}
                    </span>
                    {order.requested_delivery_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(order.requested_delivery_date)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary/60" />
              </Link>
            );
          })}
        </div>
      )}

      {/* Footer count */}
      {filteredOrders.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Нийт {filteredOrders.length} захиалга
          {searchQuery && ` (${orders.length}-с шүүсэн)`}
        </p>
      )}
    </div>
  );
}
