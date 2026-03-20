"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client"; // Таны supabase client-ийн зам
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

interface DailySummary {
  id: number;
  date: string;
  dining_hall_id: number;
  dining_hall?: { name: string };
  breakfast_count: number;
  morning_meal_count: number;
  lunch_count: number;
  dinner_count: number;
  night_meal_count: number;
  extend_morning_count: number;
  extend_lunch_count: number;
  manual_override_total: number;
  extra_serving_total: number;
  grand_total: number;
  updated_at: string;
}

export default function FoodLogSummaryPage() {
  const supabase = createClient();
  const [data, setData] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  useEffect(() => {
    async function fetchSummary() {
      setLoading(true);
      const { data: summaryData, error } = await supabase
        .from("daily_meal_summary")
        .select(`*, dining_hall ( name )`)
        .eq("date", selectedDate)
        .order("grand_total", { ascending: false });

      if (!error && summaryData) {
        setData(summaryData as any);
      }
      setLoading(false);
    }

    fetchSummary();
  }, [selectedDate, supabase]);

  const totalAllHalls = data.reduce((acc, curr) => acc + curr.grand_total, 0);

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
          <div className="rounded-md border border-white/5 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-900/50">
                <TableRow>
                  <TableHead className="w-[180px]">Гал тогоо</TableHead>
                  <TableHead className="text-right">Өглөөний цай</TableHead>
                  <TableHead className="text-right">Өглөө хоол</TableHead>
                  <TableHead className="text-right">Өдрийн хоол</TableHead>
                  <TableHead className="text-right">Оройн хоол</TableHead>
                  <TableHead className="text-right">Шөнийн хоол</TableHead>
                  <TableHead className="text-right text-orange-400">
                    Сунасан өглөө
                  </TableHead>
                  <TableHead className="text-right text-orange-400">
                    Сунасан өдөр
                  </TableHead>
                  <TableHead className="text-right bg-blue-500/10">
                    Гараар
                  </TableHead>
                  <TableHead className="text-right bg-purple-500/10">
                    Нэмэлт
                  </TableHead>
                  <TableHead className="text-right font-bold text-white">
                    Нийт
                  </TableHead>
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
                      <TableCell className="text-right text-orange-200/70">
                        {row.extend_morning_count}
                      </TableCell>
                      <TableCell className="text-right text-orange-200/70">
                        {row.extend_lunch_count}
                      </TableCell>
                      <TableCell className="text-right bg-blue-500/5">
                        {row.manual_override_total}
                      </TableCell>
                      <TableCell className="text-right bg-purple-500/5">
                        {row.extra_serving_total}
                      </TableCell>
                      <TableCell className="text-right font-bold bg-slate-800/30 text-white">
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

      <div className="text-[10px] text-slate-600 italic">
        Сүүлд шинэчлэгдсэн:{" "}
        {data[0]?.updated_at
          ? new Date(data[0].updated_at).toLocaleString()
          : "---"}
      </div>
    </div>
  );
}
