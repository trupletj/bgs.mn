import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2, ArrowLeft, Users, Utensils } from "lucide-react";
import { EmployeeModal } from "./employee-modal";

interface BreakdownData {
  org_name: string;
  dep_name: string;
  heltes_name: string;
  meal_type: string; // НЭМЭГДСЭН: Хоолны төрөл
  expected_count: number; // НЭМЭГДСЭН: Идэх ёстой хүний тоо (A)
  actual_count: number; // ӨӨРЧЛӨГДСӨН: Идсэн хүний тоо (B)
}

interface Props {
  date: string;
  hallId: number;
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

export function MealBreakdownRow({ date, hallId }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<BreakdownData[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"alba" | "heltes">("alba");
  const [activeMeal, setActiveMeal] = useState<string>("all"); // Хоолны цаг сонгох

  const [modalDetail, setModalDetail] = useState<{
    name: string;
    type: "alba" | "heltes";
  } | null>(null);

  useEffect(() => {
    async function fetchBreakdown() {
      setLoading(true);
      // RPC-г шинэчлэх шаардлагатай (доор тайлбарласан)
      const { data: bData, error } = await supabase.rpc(
        "get_meal_expected_vs_actual",
        { p_date: date, p_hall_id: hallId },
      );

      if (!error && bData) setData(bData);
      setLoading(false);
    }
    fetchBreakdown();
  }, [date, hallId, supabase]);

  // Сонгосон хоолны төрлөөр датаг шүүх
  const filteredData = useMemo(() => {
    if (activeMeal === "all") return data;
    return data.filter((d) => d.meal_type === activeMeal);
  }, [data, activeMeal]);

  // Дээд талын хоолны цагуудын нэгтгэл тооцоолох
  const mealSummary = useMemo(() => {
    const summary: Record<string, { expected: number; actual: number }> = {};
    data.forEach((item) => {
      const type = item.meal_type || "other";
      if (!summary[type]) summary[type] = { expected: 0, actual: 0 };
      summary[type].expected += item.expected_count;
      summary[type].actual += item.actual_count;

      // "Бүгд" tab-д зориулсан нийлбэр
      if (!summary["all"]) summary["all"] = { expected: 0, actual: 0 };
      summary["all"].expected += item.expected_count;
      summary["all"].actual += item.actual_count;
    });
    return summary;
  }, [data]);

  // Байгууллагын нэгтгэл (A / B тоогоор)
  const orgTotals = useMemo(() => {
    const totals: Record<string, { expected: number; actual: number }> = {};
    filteredData.forEach((item) => {
      if (!totals[item.org_name])
        totals[item.org_name] = { expected: 0, actual: 0 };
      totals[item.org_name].expected += item.expected_count;
      totals[item.org_name].actual += item.actual_count;
    });
    return Object.entries(totals).map(([name, counts]) => ({
      name,
      ...counts,
    }));
  }, [filteredData]);

  // Алба/Хэлтсийн задгай мэдээлэл
  const selectedOrgDetails = useMemo(() => {
    if (!selectedOrg) return [];
    const filtered = filteredData.filter(
      (item) => item.org_name === selectedOrg,
    );
    const totals: Record<string, { expected: number; actual: number }> = {};

    filtered.forEach((item) => {
      const key = activeTab === "alba" ? item.dep_name : item.heltes_name;
      const validKey = key || "Тодорхойгүй";
      if (!totals[validKey]) totals[validKey] = { expected: 0, actual: 0 };
      totals[validKey].expected += item.expected_count;
      totals[validKey].actual += item.actual_count;
    });

    return Object.entries(totals)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.expected - a.expected); // Хүлээгдэж буй тоогоор эрэмбэлэх
  }, [filteredData, selectedOrg, activeTab]);

  if (loading)
    return (
      <div className="p-8">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </div>
    );
  if (data.length === 0)
    return <div className="p-8 text-slate-500">Мэдээлэл олдсонгүй</div>;

  return (
    <div className="px-6 py-4 border border-slate-200 rounded-lg bg-white shadow-sm mb-4">
      {/* ХООЛНЫ ЦАГИЙН СОНГОЛТ (TABS) */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 border-b border-slate-100 scrollbar-hide">
        {Object.keys(mealSummary).map((mType) => (
          <button
            key={mType}
            onClick={() => setActiveMeal(mType)}
            className={`flex flex-col min-w-[140px] p-3 rounded-lg border transition-all ${
              activeMeal === mType
                ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400"
                : "bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50"
            }`}>
            <span className="text-xs font-semibold text-slate-500 mb-1">
              {MEAL_TYPES[mType] || mType}
            </span>
            <div className="flex items-end gap-1">
              <span className="text-xl font-bold text-slate-800">
                {mealSummary[mType].actual}
              </span>
              <span className="text-sm font-medium text-slate-400 mb-0.5">
                / {mealSummary[mType].expected}
              </span>
            </div>
            {/* Хувийн жин харуулах progress bar */}
            <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${mealSummary[mType].actual >= mealSummary[mType].expected ? "bg-green-500" : "bg-blue-500"}`}
                style={{
                  width: `${Math.min((mealSummary[mType].actual / (mealSummary[mType].expected || 1)) * 100, 100)}%`,
                }}
              />
            </div>
          </button>
        ))}
      </div>

      {!selectedOrg ? (
        // БАЙГУУЛЛАГУУДЫН НЭГТГЭЛ
        <div>
          <h4 className="text-sm font-semibold mb-3 text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4" /> Байгууллагуудын нэгтгэл
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {orgTotals.map((org, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOrg(org.name)}
                className="flex flex-col p-3 rounded-md border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left">
                <span className="text-sm font-medium text-slate-700 truncate mb-2 w-full">
                  {org.name}
                </span>
                <div className="flex justify-between items-center w-full bg-slate-50 px-2 py-1 rounded text-xs">
                  <span className="text-slate-500">Идсэн / Нийт:</span>
                  <span className="font-bold text-slate-800">
                    <span className="text-blue-600">{org.actual}</span>{" "}
                    <span className="text-slate-400">/ {org.expected}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        // АЛБА/ХЭЛТЭС ЗАДАРГАА (2 Баганатай Grid)
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setSelectedOrg(null)}
              className="p-1 hover:bg-slate-100 rounded-md">
              <ArrowLeft className="h-5 w-5 text-slate-500" />
            </button>
            <h4 className="text-sm font-semibold text-slate-700">
              {selectedOrg}
            </h4>
          </div>

          <div className="flex gap-2 mb-4 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab("alba")}
              className={`px-4 py-1.5 text-sm font-medium rounded-t-md transition-colors ${activeTab === "alba" ? "bg-slate-100 text-slate-900 border-b-2 border-b-blue-500" : "text-slate-500"}`}>
              Албаар
            </button>
            <button
              onClick={() => setActiveTab("heltes")}
              className={`px-4 py-1.5 text-sm font-medium rounded-t-md transition-colors ${activeTab === "heltes" ? "bg-slate-100 text-slate-900 border-b-2 border-b-blue-500" : "text-slate-500"}`}>
              Хэлтсээр
            </button>
          </div>

          <div className="max-w-full border rounded-md bg-white p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
              {/* АЛБА/ХЭЛТЭС ЗАДАРГАА хэсэг дотор */}
              {selectedOrgDetails.map((detail, idx) => (
                <div
                  key={idx}
                  onClick={() =>
                    setModalDetail({ name: detail.name, type: activeTab })
                  }
                  className="flex items-center justify-between py-2 px-3 border-b border-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                  <span className="text-xs font-medium text-slate-700 truncate mr-2">
                    {detail.name}
                  </span>
                  <div className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded">
                    <span className="font-bold text-blue-600">
                      {detail.actual}
                    </span>
                    <span className="text-slate-400">/</span>
                    <span className="font-medium text-slate-600">
                      {detail.expected}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {modalDetail && (
        <EmployeeModal
          isOpen={!!modalDetail}
          onClose={() => setModalDetail(null)}
          date={date}
          hallId={hallId}
          orgName={selectedOrg!}
          groupName={modalDetail.name}
          groupType={modalDetail.type}
          mealType={activeMeal}
        />
      )}
    </div>
  );
}
