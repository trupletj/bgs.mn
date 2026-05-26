"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { ChevronDown, ChevronRight, Utensils } from "lucide-react";
import { MealLogsDetailModal } from "./meal-logs-detail-modal";
import { MealBreakdownRow } from "./meal-breakdown-row";
import { SubEmployeeMealDetailModal } from "./sub-employee-meal-detail-modal";
import { DuplicateMealHallReport } from "./duplicate-meal-hall-report";

interface ExpectedBreakdownData {
  meal_type: string;
  expected_count: number;
}

interface DiningHallExpected {
  hallId: number;
  hallName: string;
  expectedByMeal: Record<string, number>;
}

interface DailyMealSummary {
  id: number | string;
  dining_hall_id: number;
  dining_hall?: {
    name?: string | null;
  } | null;
  breakfast_count?: number;
  morning_meal_count?: number;
  lunch_count?: number;
  dinner_count?: number;
  night_meal_count?: number;
  extend_morning_count?: number;
  extend_lunch_count?: number;
  manual_override_total?: number;
  extra_serving_total?: number;
  wrong_location_total?: number;
  sub_employee_total?: number;
  grand_total?: number;
  updated_at?: string | null;
}

interface Props {
  initialData: DailyMealSummary[];
  initialDate: string;
}

const MEAL_TYPE_ORDER = [
  "breakfast",
  "morning_meal",
  "lunch",
  "dinner",
  "night_meal",
  "extend_morning_meal",
  "extend_lunch",
] as const;

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Ө/цай",
  morning_meal: "Ө/хоол",
  lunch: "Өдөр",
  dinner: "Орой",
  night_meal: "Шөнө",
  extend_morning_meal: "С/ өглөө",
  extend_lunch: "С/ өдөр",
};

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Ulaanbaatar",
});

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "---";
  return UPDATED_AT_FORMATTER.format(new Date(value));
}

export default function FoodLogSummaryTable({
  initialData,
  initialDate,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<DailyMealSummary[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [formattedUpdatedAt, setFormattedUpdatedAt] = useState("---");

  // Мөр дэлгэхтэй холбоотой төлөвүүд
  const [expandedHallId, setExpandedHallId] = useState<number | null>(null);
  const [expectedByMeal, setExpectedByMeal] = useState<Record<string, number>>(
    {},
  );
  const [expectedByHall, setExpectedByHall] = useState<DiningHallExpected[]>(
    [],
  );
  const [loadingExpected, setLoadingExpected] = useState(false);

  useEffect(() => {
    setFormattedUpdatedAt(formatUpdatedAt(data[0]?.updated_at));
  }, [data]);

  useEffect(() => {
    if (selectedDate === initialDate) return;

    async function fetchSummary() {
      setLoading(true);
      const { data: summaryData, error } = await supabase
        .from("daily_meal_summary")
        .select(`*, dining_hall ( name )`)
        .eq("date", selectedDate)
        .order("grand_total", { ascending: false });

      if (!error && summaryData) {
        setData(summaryData);
        setExpandedHallId(null); // Өдөр солигдоход дэлгэсэн мөрийг хаах
      }
      setLoading(false);
    }

    fetchSummary();
  }, [selectedDate, initialDate, supabase]);

  useEffect(() => {
    let isCancelled = false;
    const fallbackHallIds = Array.from(
      new Set(
        data
          .map((row) => row.dining_hall_id)
          .filter((hallId): hallId is number => typeof hallId === "number"),
      ),
    );

    async function fetchExpectedTotals() {
      setLoadingExpected(true);

      const { data: halls, error: hallsError } = await supabase
        .from("dining_hall")
        .select("id, name")
        .order("name");

      const hallList =
        !hallsError && halls?.length
          ? halls.map((hall) => ({
              id: hall.id as number,
              name: (hall.name as string | null) || `Hall #${hall.id}`,
            }))
          : fallbackHallIds.map((hallId) => ({
              id: hallId,
              name:
                data.find((row) => row.dining_hall_id === hallId)?.dining_hall
                  ?.name || `Hall #${hallId}`,
            }));

      if (hallList.length === 0) {
        if (!isCancelled) {
          setExpectedByMeal({});
          setExpectedByHall([]);
          setLoadingExpected(false);
        }
        return;
      }

      const responses = await Promise.all(
        hallList.map((hall) =>
          supabase.rpc("get_meal_expected_vs_actual", {
            p_date: selectedDate,
            p_hall_id: hall.id,
          }),
        ),
      );

      const hallsWithExpected = hallList.map((hall, index) => {
        const response = responses[index];
        const hallTotals: Record<string, number> = {};

        if (!response.error && response.data) {
          (response.data as ExpectedBreakdownData[]).forEach((item) => {
            hallTotals[item.meal_type] =
              (hallTotals[item.meal_type] || 0) +
              Number(item.expected_count || 0);
          });
        }

        return {
          hallId: hall.id,
          hallName: hall.name,
          expectedByMeal: hallTotals,
        };
      });

      const totals = responses.reduce<Record<string, number>>(
        (acc, { data: breakdownData, error }) => {
          if (error || !breakdownData) return acc;

          (breakdownData as ExpectedBreakdownData[]).forEach((item) => {
            acc[item.meal_type] =
              (acc[item.meal_type] || 0) + Number(item.expected_count || 0);
          });

          return acc;
        },
        {},
      );

      if (!isCancelled) {
        setExpectedByMeal(totals);
        setExpectedByHall(hallsWithExpected);
        setLoadingExpected(false);
      }
    }

    fetchExpectedTotals();

    return () => {
      isCancelled = true;
    };
  }, [data, selectedDate, supabase]);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    hallId: number;
    type: "manual" | "extra" | "wrong";
    hallName: string;
  }>({
    isOpen: false,
    hallId: 0,
    type: "manual",
    hallName: "",
  });
  const [subEmployeeModalConfig, setSubEmployeeModalConfig] = useState<{
    isOpen: boolean;
    hallId: number;
    hallName: string;
  }>({
    isOpen: false,
    hallId: 0,
    hallName: "",
  });

  const openModal = (
    e: React.MouseEvent,
    hallId: number,
    type: "manual" | "extra" | "wrong",
    hallName: string,
  ) => {
    e.stopPropagation(); // Мөр дэлгэх click-тэй давхардахгүй байх
    setModalConfig({ isOpen: true, hallId, type, hallName });
  };

  const openSubEmployeeModal = (
    e: React.MouseEvent,
    hallId: number,
    hallName: string,
  ) => {
    e.stopPropagation();
    setSubEmployeeModalConfig({ isOpen: true, hallId, hallName });
  };

  // Мөр дэлгэх функц
  const toggleRow = (hallId: number) => {
    if (expandedHallId === hallId) {
      setExpandedHallId(null);
    } else {
      setExpandedHallId(hallId);
    }
  };

  const totalAllHalls = data.reduce(
    (acc, curr) => acc + (curr.grand_total || 0),
    0,
  );

  const totalExpectedMeals = Object.values(expectedByMeal).reduce(
    (acc, count) => acc + count,
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

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Utensils className="h-4 w-4 text-slate-500" />
            Тухайн өдөр идэх ёстой хоол
          </div>
          <Badge variant="secondary" className="px-3 py-1">
            Нийт тооцоолсон:{" "}
            {loadingExpected ? "..." : totalExpectedMeals.toLocaleString()}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {MEAL_TYPE_ORDER.map((mealType) => (
            <div
              key={mealType}
              className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-xs font-medium text-slate-500">
                {MEAL_TYPE_LABELS[mealType]}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900">
                {loadingExpected
                  ? "..."
                  : (expectedByMeal[mealType] || 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="min-w-[180px]">Гал тогоо</TableHead>
                {MEAL_TYPE_ORDER.map((mealType) => (
                  <TableHead key={mealType} className="text-right">
                    {MEAL_TYPE_LABELS[mealType]}
                  </TableHead>
                ))}
                <TableHead className="text-right font-bold">Нийт</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingExpected ? (
                Array(3)
                  .fill(0)
                  .map((_, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {Array(MEAL_TYPE_ORDER.length + 2)
                        .fill(0)
                        .map((_, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                    </TableRow>
                  ))
              ) : expectedByHall.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={MEAL_TYPE_ORDER.length + 2}
                    className="h-16 text-center text-slate-500">
                    Идэх ёстой хоолны мэдээлэл олдсонгүй.
                  </TableCell>
                </TableRow>
              ) : (
                expectedByHall.map((hall) => {
                  const hallTotal = Object.values(hall.expectedByMeal).reduce(
                    (acc, count) => acc + count,
                    0,
                  );

                  return (
                    <TableRow key={hall.hallId}>
                      <TableCell className="font-medium">
                        {hall.hallName}
                      </TableCell>
                      {MEAL_TYPE_ORDER.map((mealType) => (
                        <TableCell key={mealType} className="text-right">
                          {(
                            hall.expectedByMeal[mealType] || 0
                          ).toLocaleString()}
                        </TableCell>
                      ))}
                      <TableCell className="bg-slate-50 text-right font-bold">
                        {hallTotal.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
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
                  <TableHead className="w-[200px]">Гал тогоо</TableHead>
                  <TableHead className="text-right">Ө/цай</TableHead>
                  <TableHead className="text-right">Ө/хоол</TableHead>
                  <TableHead className="text-right">Өдөр</TableHead>
                  <TableHead className="text-right">Орой</TableHead>
                  <TableHead className="text-right">Шөнө</TableHead>
                  <TableHead className="text-right text-orange-600">
                    С/ өглөө
                  </TableHead>
                  <TableHead className="text-right text-orange-600">
                    С/ өдөр
                  </TableHead>
                  <TableHead className="text-right bg-blue-50">
                    Гараар
                  </TableHead>
                  <TableHead className="text-right bg-purple-50">
                    Нэмэлт
                  </TableHead>
                  <TableHead className="text-right bg-red-50 text-red-600">
                    Буруу байршил
                  </TableHead>
                  <TableHead className="text-right bg-emerald-50 text-emerald-700">
                    Гэрээт
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
                        {Array(13)
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
                      colSpan={13}
                      className="h-24 text-center text-slate-500 italic">
                      Өгөгдөл олдсонгүй.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <React.Fragment key={row.id}>
                      {/* ҮНДСЭН МӨР */}
                      <TableRow
                        className="cursor-pointer hover:bg-slate-50 group"
                        onClick={() => toggleRow(row.dining_hall_id)}>
                        <TableCell className="font-medium flex items-center gap-2">
                          {expandedHallId === row.dining_hall_id ? (
                            <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
                          )}
                          {row.dining_hall?.name ||
                            `Hall #${row.dining_hall_id}`}
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
                          className="text-right bg-blue-500/5 hover:bg-blue-500/10 hover:font-bold transition-all text-blue-700 underline decoration-dotted"
                          onClick={(e) =>
                            openModal(
                              e,
                              row.dining_hall_id,
                              "manual",
                              row.dining_hall?.name || "",
                            )
                          }>
                          {row.manual_override_total}
                        </TableCell>

                        <TableCell
                          className="text-right bg-purple-500/5 hover:bg-purple-500/10 hover:font-bold transition-all text-purple-700 underline decoration-dotted"
                          onClick={(e) =>
                            openModal(
                              e,
                              row.dining_hall_id,
                              "extra",
                              row.dining_hall?.name || "",
                            )
                          }>
                          {row.extra_serving_total}
                        </TableCell>
                        <TableCell
                          className="text-right bg-red-500/5 hover:bg-red-500/10 hover:font-bold transition-all text-red-700 underline decoration-dotted"
                          onClick={(e) =>
                            openModal(
                              e,
                              row.dining_hall_id,
                              "wrong",
                              row.dining_hall?.name || "",
                            )
                          }>
                          {row.wrong_location_total || 0}
                        </TableCell>
                        <TableCell
                          className="text-right bg-emerald-500/5 hover:bg-emerald-500/10 hover:font-bold transition-all text-emerald-700 underline decoration-dotted"
                          onClick={(e) =>
                            openSubEmployeeModal(
                              e,
                              row.dining_hall_id,
                              row.dining_hall?.name || "",
                            )
                          }>
                          {row.sub_employee_total || 0}
                        </TableCell>
                        <TableCell className="text-right font-bold bg-slate-50">
                          {row.grand_total}
                        </TableCell>
                      </TableRow>

                      {/* ДЭЛГЭГДСЭН ДЕТАЛЬ МӨР */}
                      {expandedHallId === row.dining_hall_id && (
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                          <TableCell colSpan={13} className="p-0">
                            <MealBreakdownRow
                              date={selectedDate}
                              hallId={row.dining_hall_id}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DuplicateMealHallReport date={selectedDate} />

      <div className="text-[10px] text-slate-400 italic">
        Сүүлд шинэчлэгдсэн: {formattedUpdatedAt}
      </div>
      <MealLogsDetailModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        hallId={modalConfig.hallId}
        date={selectedDate}
        type={modalConfig.type}
        hallName={modalConfig.hallName}
      />
      <SubEmployeeMealDetailModal
        isOpen={subEmployeeModalConfig.isOpen}
        onClose={() =>
          setSubEmployeeModalConfig({
            ...subEmployeeModalConfig,
            isOpen: false,
          })
        }
        hallId={subEmployeeModalConfig.hallId}
        date={selectedDate}
        mealType="all"
        hallName={subEmployeeModalConfig.hallName}
      />
    </div>
  );
}
