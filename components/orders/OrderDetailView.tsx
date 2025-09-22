"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Package,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { StatusUpdateDialog } from "./StatusUpdateDialog";
import type { Order, OrderItem, WorkflowEntry } from "@/actions/orders";

interface OrderDetailViewProps {
  orderDetails: {
    order: Order;
    items: OrderItem[];
    workflow: WorkflowEntry[];
    creator: {
      id: string;
      nice_name?: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
    };
  };
}

export function OrderDetailView({ orderDetails }: OrderDetailViewProps) {
  const { order, items, workflow, creator } = orderDetails;
  const router = useRouter();

  // For now, we'll use a test user ID. In a real app, this would come from authentication
  const currentUserId = creator.id; // Temporary - should come from auth context

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft":
        return "secondary";
      case "pending_review":
        return "outline";
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      case "in_progress":
        return "default";
      case "completed":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getUrgencyBadgeVariant = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case "critical":
      case "high":
        return <AlertTriangle className="h-4 w-4" />;
      case "medium":
        return <Clock className="h-4 w-4" />;
      case "low":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // const formatCurrency = (amount: number, currency: string = "USD") => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: currency,
  //   }).format(amount);
  // };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleStatusUpdated = () => {
    // Refresh the page to show updated data
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{order.title}</h1>
            <p className="text-muted-foreground">Order #{order.order_number}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={getStatusBadgeVariant(order.status)}>
            {order.status.replace("_", " ").toUpperCase()}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="h-4 w-4 mr-2" />
                Edit Order
              </DropdownMenuItem>
              <StatusUpdateDialog
                orderId={order.id}
                currentStatus={order.status}
                userId={currentUserId}
                onStatusUpdated={handleStatusUpdated}
              >
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Update Status
                </DropdownMenuItem>
              </StatusUpdateDialog>
              <DropdownMenuItem>Add Note</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Order Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.description && (
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-muted-foreground">{order.description}</p>
                </div>
              )}

              {/* {order.equipment_name && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-1">Equipment</h4>
                    <p className="text-sm text-muted-foreground">
                      {order.equipment_name}
                    </p>
                  </div>
                  {order.equipment_model && (
                    <div>
                      <h4 className="font-medium mb-1">Model</h4>
                      <p className="text-sm text-muted-foreground">
                        {order.equipment_model}
                      </p>
                    </div>
                  )}
                  {order.equipment_serial && (
                    <div>
                      <h4 className="font-medium mb-1">Serial Number</h4>
                      <p className="text-sm text-muted-foreground">
                        {order.equipment_serial}
                      </p>
                    </div>
                  )}
                  {order.equipment_location && (
                    <div>
                      <h4 className="font-medium mb-1">Location</h4>
                      <p className="text-sm text-muted-foreground">
                        {order.equipment_location}
                      </p>
                    </div>
                  )}
                </div>
              )} */}

              {order.notes && (
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items ({items.length})</CardTitle>
              <CardDescription>
                Энэ захиалгад хүссэн эд анги, сэлбэгүүд
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Сэлбэг, эд анги</TableHead>
                      <TableHead>Тоо</TableHead>
                      <TableHead>Төлөв</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-wrap">
                          <div>
                            <div className="font-medium">{item.part_name}</div>
                            {item.part_number && (
                              <div className="text-sm text-muted-foreground text-wrap">
                                Эдийн дугаар: {item.part_number}
                              </div>
                            )}
                            {item.manufacturer && (
                              <div className="text-sm text-muted-foreground text-wrap">
                                Үйлдвэрлэгч: {item.manufacturer}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(item.status)}>
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No items have been added to this order yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workflow History */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow History</CardTitle>
              <CardDescription>
                Status changes and updates for this order
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workflow.length > 0 ? (
                <div className="space-y-4">
                  {workflow.map((entry) => (
                    <div key={entry.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {entry.to_status === "approved" && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {entry.to_status === "rejected" && (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        {!["approved", "rejected"].includes(
                          entry.to_status
                        ) && <Clock className="h-5 w-5 text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            Status changed to{" "}
                            <Badge
                              variant={getStatusBadgeVariant(entry.to_status)}
                            >
                              {entry.to_status.replace("_", " ").toUpperCase()}
                            </Badge>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(entry.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        {entry.comments && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {entry.comments}
                          </p>
                        )}
                        {entry.user && (
                          <p className="text-xs text-muted-foreground mt-1">
                            by{" "}
                            {entry.user.nice_name ||
                              (entry.user.first_name && entry.user.last_name
                                ? `${entry.user.first_name} ${entry.user.last_name}`
                                : "") ||
                              entry.user.phone ||
                              "Unknown User"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No workflow history available.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Order Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Created by</h4>
                <p className="text-sm text-muted-foreground">
                  {creator.nice_name ||
                    (creator.first_name && creator.last_name
                      ? `${creator.first_name} ${creator.last_name}`
                      : "") ||
                    creator.phone ||
                    "Unknown"}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Priority</h4>
                <Badge
                  variant={getUrgencyBadgeVariant(order.urgency_level)}
                  className="flex items-center space-x-1 w-fit"
                >
                  {getUrgencyIcon(order.urgency_level)}
                  <span>{order.urgency_level.toUpperCase()}</span>
                </Badge>
              </div>

              <div>
                <h4 className="font-medium mb-1">Created</h4>
                <p className="text-sm text-muted-foreground">
                  {formatDate(order.created_at)}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Last Updated</h4>
                <p className="text-sm text-muted-foreground">
                  {formatDate(order.updated_at)}
                </p>
              </div>

              {order.requested_delivery_date && (
                <div>
                  <h4 className="font-medium mb-1 flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Requested Delivery</span>
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(order.requested_delivery_date)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
