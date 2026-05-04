"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

type MealLogRow = {
  id: number;
  user_id: string | null;
  bteg_id: string | null;
  sub_employee_id: string | null;
  dining_hall_id: number | null;
  meal_type: string | null;
  scanned_at: string | null;
  is_extra_serving: boolean | null;
  is_manual_override: boolean | null;
  dining_hall?: { name?: string | null } | null;
  users?: {
    bteg_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    department_name?: string | null;
    heltes_name?: string | null;
  } | null;
  sub_employee_for_food?: {
    custom_label?: string | null;
    bteg_id?: string | null;
  } | null;
};

type DuplicateGroup = {
  key: string;
  personName: string;
  personCode: string;
  orgInfo: string;
  mealType: string;
  hallCount: number;
  logCount: number;
  halls: string[];
  scans: MealLogRow[];
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Ө/цай",
  morning_meal: "Ө/хоол",
  lunch: "Өдөр",
  dinner: "Орой",
  night_meal: "Шөнө",
  extend_morning_meal: "Сунгасан өглөө",
  extend_lunch: "Сунгасан өдөр",
};

function getPersonKey(log: MealLogRow) {
  if (log.sub_employee_id) return `sub:${log.sub_employee_id}`;
  if (log.user_id) return `user:${log.user_id}`;
  if (log.bteg_id) return `bteg:${log.bteg_id}`;
  return `unknown:${log.id}`;
}

function getPersonName(log: MealLogRow) {
  if (log.sub_employee_for_food?.custom_label) {
    return log.sub_employee_for_food.custom_label;
  }

  const name = [log.users?.last_name, log.users?.first_name]
    .filter(Boolean)
    .join(" ");

  return name || log.bteg_id || "Тодорхойгүй";
}

function getPersonCode(log: MealLogRow) {
  return (
    log.users?.bteg_id ||
    log.sub_employee_for_food?.bteg_id ||
    log.bteg_id ||
    "-"
  );
}

function getOrgInfo(log: MealLogRow) {
  return [log.users?.department_name, log.users?.heltes_name]
    .filter(Boolean)
    .join(", ");
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("mn-MN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function DuplicateMealHallReport({ date }: { date: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<MealLogRow[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function fetchLogs() {
      setLoading(true);

      const { data, error } = await supabase
        .from("meal_logs")
        .select(
          `
          id,
          user_id,
          bteg_id,
          sub_employee_id,
          dining_hall_id,
          meal_type,
          scanned_at,
          is_extra_serving,
          is_manual_override,
          dining_hall ( name ),
          users ( bteg_id, first_name, last_name, department_name, heltes_name ),
          sub_employee_for_food ( custom_label, bteg_id )
        `,
        )
        .eq("date", date)
        .not("dining_hall_id", "is", null)
        .not("meal_type", "is", null)
        .order("scanned_at", { ascending: true });

      if (!isCancelled) {
        setLogs(error ? [] : ((data || []) as MealLogRow[]));
        setLoading(false);
      }
    }

    fetchLogs();

    return () => {
      isCancelled = true;
    };
  }, [date, supabase]);

  const duplicates = useMemo(() => {
    const groups = new Map<string, MealLogRow[]>();

    logs.forEach((log) => {
      const personKey = getPersonKey(log);
      const mealType = log.meal_type || "unknown";
      const key = `${personKey}|${mealType}`;
      groups.set(key, [...(groups.get(key) || []), log]);
    });

    return Array.from(groups.entries())
      .map(([key, groupLogs]) => {
        const hallIds = new Set(
          groupLogs
            .map((log) => log.dining_hall_id)
            .filter((hallId): hallId is number => typeof hallId === "number"),
        );
        const first = groupLogs[0];

        return {
          key,
          personName: getPersonName(first),
          personCode: getPersonCode(first),
          orgInfo: getOrgInfo(first),
          mealType: first.meal_type || "unknown",
          hallCount: hallIds.size,
          logCount: groupLogs.length,
          halls: Array.from(
            new Set(
              groupLogs.map(
                (log) =>
                  log.dining_hall?.name ||
                  (log.dining_hall_id ? `Hall #${log.dining_hall_id}` : "-"),
              ),
            ),
          ),
          scans: groupLogs,
        } satisfies DuplicateGroup;
      })
      .filter((group) => group.hallCount > 1)
      .sort((a, b) => b.hallCount - a.hallCount || b.logCount - a.logCount);
  }, [logs]);

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            Нэг хоолны цагт олон гал тогоонд бүртгүүлсэн
          </CardTitle>
          <Badge
            variant={duplicates.length > 0 ? "destructive" : "secondary"}
            className="px-3 py-1">
            {loading ? "..." : `${duplicates.length} хүн`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-amber-200 bg-white">
          <Table>
            <TableHeader className="bg-amber-50">
              <TableRow>
                <TableHead className="min-w-[180px]">Ажилтан</TableHead>
                <TableHead>Хэлтэс/Алба</TableHead>
                <TableHead>Хоол</TableHead>
                <TableHead>Гал тогоонууд</TableHead>
                <TableHead>Уншуулсан цагууд</TableHead>
                <TableHead className="text-right">Тоо</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(3)
                  .fill(0)
                  .map((_, index) => (
                    <TableRow key={index}>
                      {Array(6)
                        .fill(0)
                        .map((__, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                    </TableRow>
                  ))
              ) : duplicates.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-16 text-center text-slate-500">
                    Давхар гал тогоонд бүртгүүлсэн хүн олдсонгүй.
                  </TableCell>
                </TableRow>
              ) : (
                duplicates.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {item.personName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.personCode}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {item.orgInfo || "-"}
                    </TableCell>
                    <TableCell>
                      {MEAL_TYPE_LABELS[item.mealType] || item.mealType}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.halls.map((hall) => (
                          <Badge key={hall} variant="outline">
                            {hall}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {item.scans.map((scan) => (
                        <div key={scan.id}>
                          {formatTime(scan.scanned_at)} -{" "}
                          {scan.dining_hall?.name ||
                            `Hall #${scan.dining_hall_id}`}
                          {scan.is_extra_serving ? " / нэмэлт" : ""}
                          {scan.is_manual_override ? " / гараар" : ""}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-amber-800">
                      {item.logCount}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
