"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Clock, List, GitGraph, ArrowRight, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PURCHASE_MOVEMENT_LABELS } from "@/components/orders/purchase/utils";
import { format } from "date-fns";
import { mn } from "date-fns/locale";

// Төлөвийн текстийг хөрвүүлэх функц
const getStatusLabel = (status?: string | null) => {
  if (!status) return "";

  const map: Record<string, string> = {
    pending: "Шинэ",
    in_progress: "Процесс-д",
    ordered: "Захиалсан",
    shipped: "Илгээсэн",
    received: "Хүлээн авсан",
    delivered: "Хүрсэн",
    completed: "Дууссан",
    done: "Дууссан",
    cancelled: "Цуцлагдсан",
    rejected: "Татгалзсан",
  };
  return PURCHASE_MOVEMENT_LABELS[status] || map[status] || status;
};

// Төлөвийн хайрцаг (Design-ыг ижил байлгах хэсэг)
const StatusBox = ({ label }: { label: string }) => (
  <div className="px-4 py-2 rounded-xl border border-muted-foreground/30 bg-background text-[13px] font-medium whitespace-nowrap shadow-sm hover:border-primary/50 transition-colors cursor-default">
    {label}
  </div>
);

type FulfillmentStatusHistory = {
  id: string;
  old_status: string | null;
  new_status: string | null;
  reason?: string | null;
  created_at: string;
  profile?: {
    name?: string | null;
  } | null;
};

export function FulfillmentHistory({
  fulfillmentId,
}: {
  fulfillmentId: string;
}) {
  const [history, setHistory] = useState<FulfillmentStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("fulfillment_status_history")
        .select(`*, profile:changed_by ( name )`)
        .eq("fulfillment_id", fulfillmentId)
        .order("created_at", { ascending: true }); // Диаграммд зориулж хуучнаас шинэ рүү

      if (!error) setHistory((data || []) as FulfillmentStatusHistory[]);
      setLoading(false);
    };
    fetchHistory();
  }, [fulfillmentId]);

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (history.length === 0)
    return <div className="text-xs italic p-2">Түүх байхгүй байна.</div>;

  return (
    <TooltipProvider>
      <Tabs defaultValue="diagram" className="w-full">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 tracking-wider">
            <Clock className="h-3.5 w-3.5" /> Төлөвийн явц
          </h4>
          <TabsList className="h-8 bg-slate-100/50">
            <TabsTrigger value="diagram" className="text-xs gap-1.5 px-3">
              <GitGraph className="h-3.5 w-3.5" /> Диаграмм
            </TabsTrigger>
            <TabsTrigger value="table" className="text-xs gap-1.5 px-3">
              <List className="h-3.5 w-3.5" /> Хүснэгт
            </TabsTrigger>
          </TabsList>
        </div>

        {/* --- Диаграмм хэсэг --- */}
        <TabsContent value="diagram" className="mt-0">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-4">
            {history[0]?.old_status && (
              <div className="flex items-center gap-3">
                <StatusBox label={getStatusLabel(history[0].old_status)} />
                <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </div>
            )}

            {/* Түүхийн урсгал */}
            {history.map((item, index) => (
              <React.Fragment key={item.id}>
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <StatusBox label={getStatusLabel(item.new_status)} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="p-3 shadow-xl border-slate-200 bg-yellow-50">
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-2 text-xs border-b pb-1.5 mb-1.5">
                          <User className="h-3 w-3 text-blue-500" />
                          <span className="font-semibold text-slate-700">
                            {item.profile?.name || "Систем"}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(
                            new Date(item.created_at),
                            "yyyy-MM-dd HH:mm",
                            { locale: mn },
                          )}
                        </p>
                        {item.reason && (
                          <div className="bg-yellow-100 p-2 rounded text-[11px] text-slate-600 mt-2 border border-slate-100">
                            <b>Шалтгаан:</b> {item.reason}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  {index < history.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>
        </TabsContent>

        {/* --- Хүснэгт хэсэг --- */}
        <TabsContent value="table" className="mt-0">
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-bold h-9">
                    Хуучин төлөв
                  </TableHead>
                  <TableHead className="text-[11px] font-bold h-9">
                    Шинэ төлөв
                  </TableHead>
                  <TableHead className="text-[11px] font-bold h-9">
                    Шалтгаан
                  </TableHead>
                  <TableHead className="text-[11px] font-bold h-9">
                    Огноо
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...history].reverse().map((h) => (
                  <TableRow
                    key={h.id}
                    className="hover:bg-slate-50/50 border-slate-100">
                    <TableCell className="py-2.5 text-[11px] text-muted-foreground">
                      {getStatusLabel(h.old_status) || "—"}
                    </TableCell>
                    <TableCell className="py-2.5 text-[11px] font-semibold text-blue-600">
                      {getStatusLabel(h.new_status)}
                    </TableCell>
                    <TableCell className="py-2.5 text-[11px] italic max-w-[150px] truncate">
                      {h.reason || "—"}
                    </TableCell>
                    <TableCell className="py-2.5 text-[11px] text-slate-500">
                      {format(new Date(h.created_at), "MM/dd HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}
