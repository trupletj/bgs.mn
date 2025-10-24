"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, ClockIcon, UserIcon, SearchIcon } from "lucide-react";
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

const urgencyColors = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

interface Props {
  orders: Order[];
}

export function OrdersList({ orders }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchQuery ||
      order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    const matchesUrgency =
      urgencyFilter === "all" || order.urgency_level === urgencyFilter;

    return matchesSearch && matchesStatus && matchesUrgency;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Захиалгын төлөв</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="pending_approval">
                  Pending Approval
                </SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="final_approved">Final Approved</SelectItem>
                <SelectItem value="in_procurement">In Procurement</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgency</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 text-lg">No orders found</p>
            <p className="text-gray-400 mt-2">
              {orders.length === 0
                ? "You haven't created any orders yet."
                : "Try adjusting your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
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
                      <Badge
                        className={
                          urgencyColors[
                            order.urgency_level as keyof typeof urgencyColors
                          ] || urgencyColors.medium
                        }>
                        {order.urgency_level.charAt(0).toUpperCase() +
                          order.urgency_level.slice(1)}
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
                        Created {formatDate(order.created_at)}
                      </div>
                      {order.requested_delivery_date && (
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          Delivery: {formatDate(order.requested_delivery_date)}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <UserIcon className="h-4 w-4" />
                        You
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <Link href={`/orders/${order.id}`}>
                      <Button variant="outline" size="sm" className="mt-2">
                        View Details
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
