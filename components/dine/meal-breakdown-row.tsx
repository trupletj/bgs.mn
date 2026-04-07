import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
interface BreakdownData {
  org_name: string;
  dep_name: string;
  heltes_name: string;
  total_count: number;
}

interface Props {
  date: string;
  hallId: number;
}

export function MealBreakdownRow({ date, hallId }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<BreakdownData[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"alba" | "heltes">("alba");

  useEffect(() => {
    async function fetchBreakdown() {
      setLoading(true);
      const { data: bData, error } = await supabase.rpc(
        "get_meal_breakdown_by_org",
        { p_date: date, p_hall_id: hallId },
      );

      console.log("Breakdown data:", bData, "Error:", error);

      if (!error && bData) setData(bData);
      setLoading(false);
    }
    fetchBreakdown();
  }, [date, hallId, supabase]);

  const orgTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    data.forEach((item) => {
      totals[item.org_name] = (totals[item.org_name] || 0) + item.total_count;
    });
    return Object.entries(totals).map(([name, count]) => ({ name, count }));
  }, [data]);

  const selectedOrgDetails = useMemo(() => {
    if (!selectedOrg) return [];

    const filtered = data.filter((item) => item.org_name === selectedOrg);
    const totals: Record<string, number> = {};

    filtered.forEach((item) => {
      const key = activeTab === "alba" ? item.dep_name : item.heltes_name;
      const validKey = key || "Тодорхойгүй";
      totals[validKey] = (totals[validKey] || 0) + item.total_count;
    });

    return Object.entries(totals)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count); // Тоогоор нь бууруулах
  }, [data, selectedOrg, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6 px-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Өгөгдөл уншиж байна...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic py-6 px-8">
        Задаргааны мэдээлэл олдсонгүй
      </div>
    );
  }

  return (
    <div className="px-8 py-4 border-l-4 border-l-blue-500 bg-white">
      {!selectedOrg ? (
        // --- АЛХАМ 1: БАЙГУУЛЛАГУУДЫН ЖАГСААЛТ ---
        <div>
          <h4 className="text-sm font-semibold mb-3 text-slate-700">
            Байгууллагуудын нэгтгэл
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {orgTotals.map((org, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOrg(org.name)}
                className="flex items-center justify-between p-3 rounded-md border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left">
                <span className="text-sm font-medium text-slate-700 truncate pr-2">
                  {org.name}
                </span>
                <span className="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  {org.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        // --- АЛХАМ 2: СОНГОСОН БАЙГУУЛЛАГЫН ЗАДАРГАА (АЛБА/ХЭЛТЭС) ---
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setSelectedOrg(null)}
              className="p-1 hover:bg-slate-100 rounded-md transition-colors">
              <ArrowLeft className="h-5 w-5 text-slate-500" />
            </button>
            <h4 className="text-sm font-semibold text-slate-700">
              {selectedOrg}
            </h4>
          </div>

          <div className="flex gap-2 mb-4 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab("alba")}
              className={`px-4 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
                activeTab === "alba"
                  ? "bg-slate-100 text-slate-900 border-b-2 border-b-blue-500"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              Албаар
            </button>
            <button
              onClick={() => setActiveTab("heltes")}
              className={`px-4 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
                activeTab === "heltes"
                  ? "bg-slate-100 text-slate-900 border-b-2 border-b-blue-500"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              Хэлтсээр
            </button>
          </div>

          <div className="max-w-full border rounded-md bg-white p-2">
            {/* Хүснэгтийн толгой хэсэг (Одоогийн байдлаар хэвээр үлдээв) */}
            <div className="grid grid-cols-2 gap-x-8 bg-slate-50 border-b py-2 px-4 mb-2">
              <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>
                  {activeTab === "alba" ? "Албаны нэр" : "Хэлтсийн нэр"}
                </span>
                <span className="pr-4">Тоо</span>
              </div>
              <div className="hidden md:flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>
                  {activeTab === "alba" ? "Албаны нэр" : "Хэлтсийн нэр"}
                </span>
                <span className="pr-4">Тоо</span>
              </div>
            </div>

            {/* Өгөгдлийн хэсэг - Grid 2 багана */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1">
              {selectedOrgDetails.map((detail, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 px-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <span className="text-xs font-medium text-slate-700 truncate mr-2">
                    {detail.name}
                  </span>
                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded min-w-[32px] text-center">
                    {detail.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
