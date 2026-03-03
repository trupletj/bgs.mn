"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { createFulfillment } from "@/actions/fulfillment";
import { Plus, Clock, Truck, CheckCircle2, XCircle } from "lucide-react";
import { UNIT_OPTIONS } from "@/types";
import {
  getOrderItemsForOrderProcess,
  updateFulfillmentStatus,
} from "@/actions/order-process";
import { FulfillmentHistory } from "@/components/orders/fulfillment-history";

export default function OrderImplementationPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getOrderItemsForOrderProcess(orderId);
        setItems(data);
      } catch (err) {
        toast.error("Өгөгдөл татахад алдаа гарлаа");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderId]);

  if (loading) return <div className="p-10 text-center">Ачаалж байна...</div>;

  return (
    <div className="p-6 space-y-4 w-full mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Захиалгын биелэлт</h1>
      </div>

      <div className="grid gap-5">
        {items.map((item) => (
          <OrderItemCard key={item.id} item={item} orderId={orderId} />
        ))}
      </div>
    </div>
  );
}

function OrderItemCard({ item, orderId }: { item: any; orderId: string }) {
  const [qtyInput, setQtyInput] = useState("");
  const [notes, setNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("ordered");
  // Хуучин: const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const completedStatuses = ["received", "completed", "done"];

  const STATUS_OPTIONS = [
    { value: "ordered", label: "Захиалсан" },
    { value: "shipped", label: "Хүргэлтэд гарсан" },
    { value: "received", label: "Хүлээн авсан" },
    { value: "completed", label: "Дууссан" },
    { value: "cancelled", label: "Цуцлагдсан" },
  ];

  const totalCompleted = item.order_fulfillment
    .filter((f: any) => completedStatuses.includes(f.status?.toLowerCase()))
    .reduce((sum: number, f: any) => sum + Number(f.quantity || 0), 0);

  const toggleHistory = (id: string) => {
    setExpandedIds(
      (prev) =>
        prev.includes(id)
          ? prev.filter((item) => item !== id) // Байвал хасах
          : [...prev, id], // Байхгүй бол нэмэх
    );
  };

  const percent =
    item.final_quantity > 0
      ? Math.min(100, Math.round((totalCompleted / item.final_quantity) * 100))
      : 0;

  const handleAddFulfillment = async () => {
    const qty = Number(qtyInput);
    if (!qty || qty <= 0) return toast.error("Зөв тоо оруулна уу");

    setIsAdding(true);
    try {
      await createFulfillment({
        orderItemId: item.id,
        quantity: qty,
        notes: notes.trim() || undefined,
        path: `/orders/${orderId}/implementation`,
        status: selectedStatus,
      });
      toast.success("Шинэ биелэлт бүртгэгдлээ");
      setQtyInput("");
      setNotes("");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Алдаа гарлаа");
    } finally {
      setIsAdding(false);
    }
  };

  const getStatusInfo = (status: string = "unknown") => {
    const s = status.toLowerCase();
    if (["received", "completed", "done"].includes(s)) {
      return {
        color: "bg-emerald-100 text-emerald-800 border-emerald-300",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        text: "Хүлээн авсан / Дууссан",
      };
    }
    if (s === "shipped") {
      return {
        color: "bg-amber-100 text-amber-800 border-amber-300",
        icon: <Truck className="h-3.5 w-3.5" />,
        text: "Хүргэлтэд",
      };
    }
    if (s === "ordered") {
      return {
        color: "bg-blue-100 text-blue-800 border-blue-300",
        icon: <Clock className="h-3.5 w-3.5" />,
        text: "Захиалсан",
      };
    }
    if (s === "cancelled") {
      return {
        color: "bg-red-100 text-red-800 border-red-300",
        icon: <XCircle className="h-3.5 w-3.5" />,
        text: "Цуцлагдсан",
      };
    }
    return {
      color: "bg-gray-100 text-gray-700 border-gray-300",
      icon: null,
      text: status,
    };
  };

  const getUnitLabel = (value: string) => {
    const option = UNIT_OPTIONS.find((opt) => opt.value === value);
    return option ? option.label : value || "ш";
  };

  return (
    <Card className="overflow-hidden">
      <Accordion type="single" collapsible>
        <AccordionItem value={`item-${item.id}`} className="border-0">
          <AccordionTrigger className="px-5 hover:border-b-0">
            <div className="w-full flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-lg flex items-center gap-2">
                  {item.part_name}
                  <Badge variant="outline" className="text-xs font-normal">
                    {item.part_number || "Код байхгүй"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.final_quantity} {getUnitLabel(item.unit)}
                </div>
              </div>

              <div className="w-full sm:w-auto min-w-[180px]">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">Биелэлт:</span>
                  <span className="font-bold">{percent}%</span>
                </div>
                <Progress
                  value={percent}
                  className="h-2"
                  indicatorClassName={
                    percent >= 100
                      ? "bg-emerald-600"
                      : percent >= 50
                        ? "bg-amber-500"
                        : "bg-blue-500"
                  }
                />
                <div className="text-xs mt-1 text-right ">
                  {totalCompleted} / {item.final_quantity}
                </div>
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="px-5 pb-6">
            <div className="space-y-6">
              {/* Биелэлтүүдийн жагсаалт */}
              <div className="rounded-lg border  overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-100">
                    <TableRow className="font-bold">
                      <TableHead className="w-12 font-bold">№</TableHead>
                      <TableHead className="w-28 font-bold">Тоо</TableHead>
                      <TableHead className="w-36 font-bold">Төлөв</TableHead>
                      <TableHead className="font-bold">Тэмдэглэл</TableHead>
                      <TableHead className="w-36 font-bold ">Огноо</TableHead>
                      <TableHead className="w-24 font-bold text-right">
                        Төлөв өөрчлөх
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.order_fulfillment?.length > 0 ? (
                      item.order_fulfillment.map((f: any, idx: number) => {
                        const statusInfo = getStatusInfo(f.status);
                        const isExpanded = expandedIds.includes(f.id);
                        return (
                          <React.Fragment key={f.id}>
                            <TableRow
                              key={f.id}
                              className="hover:bg-slate-100/50"
                              onClick={() => toggleHistory(f.id)}>
                              <TableCell className="font-medium">
                                {idx + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                {f.quantity} {getUnitLabel(item.unit)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`px-2.5 py-0.5 text-xs font-medium border ${statusInfo.color} flex items-center gap-1 w-fit`}>
                                  {statusInfo.icon}
                                  {statusInfo.text}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {f.notes || (
                                  <span className="text-muted-foreground italic">
                                    —
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(f.created_at).toLocaleString(
                                  "mn-MN",
                                  {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <select
                                  value={f.status}
                                  onClick={(e) => e.stopPropagation()} // Мөр дарагдаж түүх нээгдэхээс сэргийлнэ
                                  onChange={async (e) => {
                                    e.stopPropagation();
                                    const newStatus = e.target.value;
                                    if (newStatus === f.status) return;

                                    // Баталгаажуулалт асуух
                                    const confirmed = window.confirm(
                                      `Төлөвийг "${newStatus}" болгож өөрчлөхөд итгэлтэй байна уу?`,
                                    );
                                    if (!confirmed) return;

                                    try {
                                      await updateFulfillmentStatus({
                                        fulfillmentId: f.id,
                                        newStatus,
                                        oldStatus: f.status,
                                        reason: "Админ өөрчилсөн",
                                      });
                                      toast.success("Статус шинэчлэгдлээ");
                                      window.location.reload();
                                    } catch (err) {
                                      toast.error("Алдаа гарлаа");
                                    }
                                  }}
                                  className="text-xs border rounded px-2 py-1 bg-white relative z-10">
                                  {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="bg-slate-50/50">
                                <TableCell
                                  colSpan={6}
                                  className="p-4 border-t-0">
                                  <div className="bg-white rounded-md border p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                                    <FulfillmentHistory fulfillmentId={f.id} />
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground">
                          Одоогоор биелэлт бүртгэгдээгүй байна
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Шинэ биелэлт нэмэх */}
              <div className="p-5 border border-dashed rounded-lg bg-white">
                <div className="flex-1 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Тоо хэмжээ
                    </label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Жишээ нь 50"
                      value={qtyInput}
                      onChange={(e) => setQtyInput(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Статус
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Тэмдэглэл
                    </label>
                    <Input
                      placeholder="Хүргэлт гэх мэт"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleAddFulfillment}
                    disabled={isAdding || !qtyInput.trim()}
                    className="min-w-[140px]">
                    {isAdding ? (
                      "Хадгалж байна..."
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Биелэлт бүртгэх
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
