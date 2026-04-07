"use client";

import { useState, useEffect } from "react";
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  hallId: number;
  date: string;
  type: "manual" | "extra" | "wrong";
  hallName: string;
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Ө/цай",
  morning_meal: "Ө/хоол",
  lunch: "Өдөр",
  dinner: "Орой",
  night_meal: "Шөнө",
  extend_morning_meal: "Сунгасан Өглөө",
  extend_lunch: "Сунгасан Өдөр",
};

export function MealLogsDetailModal({
  isOpen,
  onClose,
  hallId,
  date,
  type,
  hallName,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) fetchDetails();
  }, [isOpen]);

  async function fetchDetails() {
    setLoading(true);
    setDetails([]);

    let query = supabase
      .from("meal_logs")
      .select("*, users(id, last_name, first_name)")
      .eq("dining_hall_id", hallId)
      .eq("date", date);

    if (type === "manual") {
      query = query.eq("is_manual_override", true);
    } else if (type === "extra") {
      query = query.eq("is_extra_serving", true);
    } else if (type === "wrong") {
      query = query.eq("is_wrong_location", true);
    }
    const { data: logs, error: logError } = await query;

    if (!logError && logs && logs.length > 0) {
      const btegIds = logs.map((l) => l.bteg_id).filter(Boolean);

      if (btegIds.length > 0) {
        const { data: users, error: userError } = await supabase
          .from("users")
          .select(
            "bteg_id, first_name, last_name, heltes_name, department_name, position_name",
          )
          .in("bteg_id", btegIds);

        if (!userError && users) {
          const merged = logs.map((log) => ({
            ...log,
            user: users.find((u) => u.bteg_id === log.bteg_id),
          }));
          setDetails(merged);
        }
      }
    }
    setLoading(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-2/3 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {hallName} -{" "}
            {type === "manual" ? "Гараар бүртгэсэн" : "Нэмэлт хооллолт"} (
            {details.length})
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Овог Нэр</TableHead>
                <TableHead>Хэлтэс/Алба</TableHead>
                <TableHead>Цаг</TableHead>
                <TableHead className="text-right">Төрөл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(3)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : details.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-10 text-slate-500">
                    Бүртгэл олдсонгүй.
                  </TableCell>
                </TableRow>
              ) : (
                details.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      {item.user
                        ? `${item.user.last_name} ${item.user.first_name}`
                        : item.bteg_id}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {[item.user?.heltes_name, item.user?.department_name]
                        .filter(Boolean)
                        .join(", ")}
                    </TableCell>
                    <TableCell className="">
                      {new Date(item.scanned_at).toLocaleTimeString("mn-MN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </TableCell>
                    <TableCell className="text-right  font-mono uppercase">
                      {MEAL_TYPE_LABELS[item.meal_type] || item.meal_type}
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
