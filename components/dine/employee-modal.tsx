import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { X, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

interface EmployeeDetail {
  worker_id: string;
  first_name: string;
  last_name: string;
  is_expected: boolean;
  has_eaten: boolean;
  meal_time: string | null;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  hallId: number;
  orgName: string;
  groupName: string;
  groupType: "alba" | "heltes";
  mealType: string;
}

const MEAL_TYPES: Record<string, string> = {
  all: "Бүгд",
  breakfast: "Өглөөний цай",
  morning_meal: "Өглөөний хоол",
  lunch: "Өдрийн хоол",
  dinner: "Оройн хоол",
  night_meal: "Шөнийн хоол",
  extend_morning_meal: "Өглөөний хоол (с)",
  extend_lunch: "Өдрийн хоол (с)",
};

export function EmployeeModal({
  isOpen,
  onClose,
  date,
  hallId,
  orgName,
  groupName,
  groupType,
  mealType,
}: ModalProps) {
  const supabase = createClient();
  const [employees, setEmployees] = useState<EmployeeDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchEmployees() {
      setLoading(true);
      // Шинэ RPC функц дуудах
      const { data, error } = await supabase.rpc("get_meal_employee_details", {
        p_date: date,
        p_hall_id: hallId,
        p_org_name: orgName,
        p_group_name: groupName,
        p_group_type: groupType,
        p_meal_type: mealType === "all" ? null : mealType, // 'all' байвал null явуулна
      });

      if (!error && data) {
        setEmployees(data);
      } else {
        console.error(error);
      }
      setLoading(false);
    }

    fetchEmployees();
  }, [isOpen, date, hallId, orgName, groupName, groupType, mealType, supabase]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {groupName}{" "}
              <span className="text-sm font-normal text-slate-500">
                ({orgName})
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {mealType === "all"
                ? "Бүх хоолны цаг"
                : MEAL_TYPES[mealType] || mealType}{" "}
              | {date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm">Ажилтнуудын мэдээллийг татаж байна...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              Мэдээлэл олдсонгүй
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Ажилтан</th>
                    <th className="px-4 py-3 text-center">Төлөвлөгөө</th>
                    <th className="px-4 py-3 text-center">Бодит байдал</th>
                    <th className="px-4 py-3 text-right">Идсэн цаг</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {emp.last_name ? `${emp.last_name[0]}. ` : ""}
                          {emp.first_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {emp.worker_id}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {emp.is_expected ? (
                          <span className="inline-flex px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                            Идэх ёстой
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {emp.has_eaten ? (
                          <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 className="w-4 h-4" /> Идсэн
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                            <XCircle className="w-4 h-4" /> Идээгүй
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">
                        {emp.meal_time ? (
                          <span className="flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3" /> {emp.meal_time}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
