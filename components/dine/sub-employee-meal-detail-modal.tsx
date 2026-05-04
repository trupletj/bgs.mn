"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  hallId: number;
  orgName?: string;
  mealType: string;
  hallName?: string;
}

interface DetailRow {
  id: number;
  qrLabel: string;
  linkedUserName: string | null;
  companyName: string;
  mealType: string;
  scannedAt: string;
  isExpected: boolean;
}

interface OrganizationRow {
  id: string;
  name: string | null;
}

interface SubEmployeeRow {
  id: string;
  org_id: string;
  custom_label: string | null;
  bteg_id: string | null;
}

interface MealLogRow {
  id: number;
  meal_type: string;
  scanned_at: string;
  sub_employee_id: string;
}

interface UserRow {
  bteg_id: string;
  first_name: string | null;
  last_name: string | null;
}

interface PlanRow {
  org_id: string;
  breakfast_count: number | null;
  morning_meal_count: number | null;
  lunch_count: number | null;
  dinner_count: number | null;
  night_meal_count: number | null;
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  all: "Бүгд",
  breakfast: "Өглөөний цай",
  morning_meal: "Өглөөний хоол",
  lunch: "Өдрийн хоол",
  dinner: "Оройн хоол",
  night_meal: "Шөнийн хоол",
  extend_morning_meal: "Сунгасан өглөө",
  extend_lunch: "Сунгасан өдөр",
};

const PLAN_FIELD_BY_MEAL: Record<string, string> = {
  breakfast: "breakfast_count",
  morning_meal: "morning_meal_count",
  lunch: "lunch_count",
  dinner: "dinner_count",
  night_meal: "night_meal_count",
};

function getPlannedCount(plan: PlanRow | undefined, mealType: string): number {
  if (!plan) return 0;
  if (mealType === "breakfast") return Number(plan.breakfast_count || 0);
  if (mealType === "morning_meal") return Number(plan.morning_meal_count || 0);
  if (mealType === "lunch") return Number(plan.lunch_count || 0);
  if (mealType === "dinner") return Number(plan.dinner_count || 0);
  if (mealType === "night_meal") return Number(plan.night_meal_count || 0);
  return 0;
}

export function SubEmployeeMealDetailModal({
  isOpen,
  onClose,
  date,
  hallId,
  orgName,
  mealType,
  hallName,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DetailRow[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchDetails() {
      setLoading(true);
      setRows([]);

      let logsQuery = supabase
        .from("meal_logs")
        .select("id, meal_type, scanned_at, sub_employee_id")
        .eq("date", date)
        .eq("dining_hall_id", hallId)
        .not("sub_employee_id", "is", null)
        .order("scanned_at", { ascending: false });

      if (mealType !== "all") {
        logsQuery = logsQuery.eq("meal_type", mealType);
      }

      const { data: rawLogs } = await logsQuery;
      const logs = (rawLogs || []) as MealLogRow[];
      if (logs.length === 0) {
        setLoading(false);
        return;
      }

      const subEmployeeIds = Array.from(
        new Set(logs.map((log) => log.sub_employee_id)),
      );

      let subEmployeesQuery = supabase
        .from("sub_employee_for_food")
        .select("id, org_id, custom_label, bteg_id")
        .in("id", subEmployeeIds);

      if (orgName) {
        const { data: orgs } = await supabase
          .from("organization")
          .select("id, name")
          .eq("name", orgName)
          .limit(1);

        const org = orgs?.[0] as OrganizationRow | undefined;
        if (!org?.id) {
          setLoading(false);
          return;
        }

        subEmployeesQuery = subEmployeesQuery.eq("org_id", org.id);
      }

      const { data: rawSubEmployees } = await subEmployeesQuery;
      const subEmployees = (rawSubEmployees || []) as SubEmployeeRow[];
      if (subEmployees.length === 0) {
        setLoading(false);
        return;
      }

      const orgIds = Array.from(
        new Set(subEmployees.map((item) => item.org_id).filter(Boolean)),
      );

      const [{ data: rawOrgs }, { data: rawPlans }] = await Promise.all([
        orgIds.length > 0
          ? supabase.from("organization").select("id, name").in("id", orgIds)
          : Promise.resolve({ data: [] }),
        orgIds.length > 0
          ? supabase
              .from("sub_employee_meal_plans")
              .select(
                "org_id, breakfast_count, morning_meal_count, lunch_count, dinner_count, night_meal_count",
              )
              .in("org_id", orgIds)
              .eq("dining_hall_id", hallId)
              .eq("date", date)
          : Promise.resolve({ data: [] }),
      ]);

      const btegIds = Array.from(
        new Set(subEmployees.map((item) => item.bteg_id).filter(Boolean)),
      ) as string[];

      const { data: linkedUsers } =
        btegIds.length > 0
          ? await supabase
              .from("users")
              .select("bteg_id, first_name, last_name")
              .in("bteg_id", btegIds)
          : { data: [] };

      const subEmployeeMap = new Map(
        subEmployees.map((item) => [item.id, item]),
      );
      const orgNameById = new Map(
        ((rawOrgs || []) as OrganizationRow[]).map((org) => [
          org.id,
          org.name || "Гэрээт байгууллага тодорхойгүй",
        ]),
      );
      const planByOrgId = new Map(
        ((rawPlans || []) as PlanRow[]).map((plan) => [plan.org_id, plan]),
      );
      const userNameByBteg = new Map(
        ((linkedUsers || []) as UserRow[]).map((user) => [
          user.bteg_id,
          `${user.last_name ?? ""} ${user.first_name ?? ""}`.trim() || null,
        ]),
      );

      setRows(
        logs.flatMap((log) => {
          const subEmployee = subEmployeeMap.get(log.sub_employee_id);
          if (!subEmployee) return [];

          const plan = planByOrgId.get(subEmployee.org_id);
          const planField = PLAN_FIELD_BY_MEAL[log.meal_type];

          return [
            {
              id: log.id,
              qrLabel: subEmployee?.custom_label || "QR тодорхойгүй",
              linkedUserName: subEmployee?.bteg_id
                ? userNameByBteg.get(subEmployee.bteg_id) || null
                : null,
              companyName:
                orgNameById.get(subEmployee.org_id) ||
                "Гэрээт байгууллага тодорхойгүй",
              mealType: log.meal_type,
              scannedAt: log.scanned_at,
              isExpected: planField
                ? getPlannedCount(plan, log.meal_type) > 0
                : false,
            },
          ];
        }),
      );

      setLoading(false);
    }

    fetchDetails();
  }, [isOpen, date, hallId, orgName, mealType, supabase]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Гэрээт ажилчдын хооллолт
            {orgName ? ` - ${orgName}` : hallName ? ` - ${hallName}` : ""} (
            {rows.length})
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>QR label</TableHead>
                <TableHead>Холбосон ажилтан</TableHead>
                <TableHead>Байгууллага</TableHead>
                <TableHead>Хоол</TableHead>
                <TableHead>Төлөвлөгөө</TableHead>
                <TableHead className="text-right">Идсэн цаг</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(4)
                  .fill(0)
                  .map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-slate-500">
                    Бүртгэл олдсонгүй.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.qrLabel}</TableCell>
                    <TableCell>
                      {row.linkedUserName || (
                        <span className="text-slate-400">Холбоогүй</span>
                      )}
                    </TableCell>
                    <TableCell>{row.companyName}</TableCell>
                    <TableCell>
                      {MEAL_TYPE_LABELS[row.mealType] || row.mealType}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.isExpected ? "default" : "outline"}>
                        {row.isExpected ? "Төлөвлөгөөтэй" : "Төлөвлөгөөгүй"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {new Date(row.scannedAt).toLocaleTimeString("mn-MN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
