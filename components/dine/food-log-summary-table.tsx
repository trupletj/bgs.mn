"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MealLogsDetailModal } from "./meal-logs-detail-modal";

interface Props {
  initialData: any[];
  initialDate: string;
}

export default function FoodLogSummaryTable({
  initialData,
  initialDate,
}: Props) {
  const supabase = createClient();
  const [data, setData] = useState<any[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  useEffect(() => {
    if (selectedDate === initialDate && data.length === initialData.length)
      return;

    async function fetchSummary() {
      setLoading(true);
      const { data: summaryData, error } = await supabase
        .from("daily_meal_summary")
        .select(`*, dining_hall ( name )`)
        .eq("date", selectedDate)
        .order("grand_total", { ascending: false });

      if (!error && summaryData) {
        setData(summaryData);
      }
      setLoading(false);
    }

    fetchSummary();
  }, [selectedDate, initialDate, supabase]);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    hallId: number;
    type: "manual" | "extra";
    hallName: string;
  }>({
    isOpen: false,
    hallId: 0,
    type: "manual",
    hallName: "",
  });

  const openModal = (
    hallId: number,
    type: "manual" | "extra",
    hallName: string,
  ) => {
    setModalConfig({ isOpen: true, hallId, type, hallName });
  };

  const totalAllHalls = data.reduce(
    (acc, curr) => acc + (curr.grand_total || 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Хоолны нэгдсэн тайлан
          </h1>
          <p className="text-slate-500 text-sm">
            Гал тогоо бүрийн хооллолтын статистик
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Input
            type="date"
            className="w-40"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <Badge variant="outline" className="px-4 py-1 text-sm">
            Нийт: {totalAllHalls.toLocaleString()}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Өдрийн задаргаа</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[180px]">Гал тогоо</TableHead>
                  <TableHead className="text-right">Ө/цай</TableHead>
                  <TableHead className="text-right">Ө/хоол</TableHead>
                  <TableHead className="text-right">Өдөр</TableHead>
                  <TableHead className="text-right">Орой</TableHead>
                  <TableHead className="text-right">Шөнө</TableHead>
                  <TableHead className="text-right text-orange-600">
                    Сунасан өглөө
                  </TableHead>
                  <TableHead className="text-right text-orange-600">
                    Сунасан өдөр
                  </TableHead>
                  <TableHead className="text-right bg-blue-50">
                    Гараар
                  </TableHead>
                  <TableHead className="text-right bg-purple-50">
                    Нэмэлт
                  </TableHead>
                  <TableHead className="text-right font-bold">Нийт</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(3)
                    .fill(0)
                    .map((_, i) => (
                      <TableRow key={i}>
                        {Array(11)
                          .fill(0)
                          .map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                      </TableRow>
                    ))
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="h-24 text-center text-slate-500 italic">
                      Өгөгдөл олдсонгүй.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.dining_hall?.name || `Hall #${row.dining_hall_id}`}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.breakfast_count}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.morning_meal_count}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.lunch_count}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.dinner_count}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.night_meal_count}
                      </TableCell>
                      <TableCell className="text-right text-orange-600/80">
                        {row.extend_morning_count}
                      </TableCell>
                      <TableCell className="text-right text-orange-600/80">
                        {row.extend_lunch_count}
                      </TableCell>
                      <TableCell
                        className="text-right bg-blue-500/5 cursor-pointer hover:bg-blue-500/10 hover:font-bold transition-all text-blue-700 underline decoration-dotted"
                        onClick={() =>
                          openModal(
                            row.dining_hall_id,
                            "manual",
                            row.dining_hall?.name,
                          )
                        }>
                        {row.manual_override_total}
                      </TableCell>

                      {/* НЭМЭЛТ */}
                      <TableCell
                        className="text-right bg-purple-500/5 cursor-pointer hover:bg-purple-500/10 hover:font-bold transition-all text-purple-700 underline decoration-dotted"
                        onClick={() =>
                          openModal(
                            row.dining_hall_id,
                            "extra",
                            row.dining_hall?.name,
                          )
                        }>
                        {row.extra_serving_total}
                      </TableCell>
                      <TableCell className="text-right font-bold bg-slate-50">
                        {row.grand_total}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="text-[10px] text-slate-400 italic">
        Сүүлд шинэчлэгдсэн:{" "}
        {data[0]?.updated_at
          ? new Date(data[0].updated_at).toLocaleString()
          : "---"}
      </div>
      <MealLogsDetailModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        hallId={modalConfig.hallId}
        date={selectedDate}
        type={modalConfig.type}
        hallName={modalConfig.hallName}
      />
    </div>
  );
}
