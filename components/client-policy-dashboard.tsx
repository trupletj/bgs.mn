"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, TrendingUp } from "lucide-react";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import PolicyDetailSheet from "./policy/policy-stats-sheet";
import { Button } from "./ui/button";
import Link from "next/link";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

// const actionTypes = [
//   { value: "IMPLEMENTATION", label: "Хэрэгжүүлэлт" },
//   { value: "MONITORING", label: "Хяналт" },
//   { value: "VERIFICATION", label: "Баталгаажуулалт" },
//   { value: "DEPLOYMENT", label: "Нэвтрүүлэлт" },
// ] as const;

const sortByReferenceNumber = (clauses: any[]) => {
  return [...clauses].sort((a, b) => {
    const partsA = (a.reference_number || "").split(".").map(Number);
    const partsB = (b.reference_number || "").split(".").map(Number);

    const maxLength = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < maxLength; i++) {
      const partA = partsA[i] ?? 0;
      const partB = partsB[i] ?? 0;
      if (partA !== partB) return partA - partB;
    }
    return 0;
  });
};

// function TabButton({
//   active,
//   onClick,
//   children,
//   icon: Icon,
// }: {
//   active: boolean;
//   onClick: () => void;
//   children: React.ReactNode;
//   icon: React.ComponentType<{ className: string }>;
// }) {
//   return (
//     <button
//       onClick={onClick}
//       className={`flex items-center gap-2 px-4 py-3 font-medium transition-all duration-200 border-b-2 whitespace-nowrap ${
//         active
//           ? "border-blue-500 text-blue-600 bg-blue-50"
//           : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
//       }`}>
//       <Icon className="w-4 h-4" />
//       {children}
//     </button>
//   );
// }

export default function ClientPolicyDashboard({
  policies,
}: {
  policies: any[];
}) {
  const [sortBy, setSortBy] = useState<"percent" | "name">("percent");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [showUnrated, setShowUnrated] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "clauses">(
    "overview"
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const filteredPolicies = showUnrated
    ? policies
    : policies.filter((p: any) => p.validCount > 0);

  const sortedPolicies = [...filteredPolicies].sort((a: any, b: any) => {
    const av = sortBy === "percent" ? a.implementationPercent : a.name;
    const bv = sortBy === "percent" ? b.implementationPercent : b.name;
    return order === "asc" ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
  });

  const chartData = sortedPolicies.map((p: any) => ({
    name: p.name,
    Хувь: p.implementationPercent,
  }));
  const ratedPolicies = policies.filter((p) => p.validCount > 0);

  const avgPercent =
    ratedPolicies.length > 0
      ? Math.round(
          ratedPolicies.reduce((s, p) => s + p.implementationPercent, 0) /
            ratedPolicies.length
        )
      : 0;

  const unratedCount = policies.filter((p) => p.validCount === 0).length;

  const getStatusColor = (percent: number) => {
    if (percent >= 90)
      return "bg-emerald-500/20 text-emerald-700 border-emerald-200";
    if (percent >= 70) return "bg-amber-500/20 text-amber-700 border-amber-200";
    return "bg-red-500/20 text-red-700 border-red-200";
  };

  const getPercentBadgeColor = (percent: number) => {
    if (percent >= 90) return "bg-emerald-500";
    if (percent >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Журмын хэрэгжилтийн хяналт
            </h1>
            <Link
              className="text-blue-600 hover:text-blue-800 ml-auto"
              href="/policy">
              <Button>Журмын жагсаалт</Button>
            </Link>
          </div>
          <p className="text-slate-600 ml-14">
            Бүх журмын хэрэгжилтийн үнэлгээ ба аудит тайлан
          </p>
        </div>

        {/* Switch */}
        <div className="flex items-center space-x-3 bg-white rounded-xl p-5 shadow-sm border border-slate-200 mb-8">
          <Switch
            id="show-unrated"
            checked={showUnrated}
            onCheckedChange={setShowUnrated}
          />
          <Label
            htmlFor="show-unrated"
            className="cursor-pointer text-base font-medium text-slate-700 flex items-center gap-3 select-none">
            Үнэлгээ хийгдээгүй журмуудыг харуулах
            <Badge variant="secondary" className="font-bold">
              {unratedCount}
            </Badge>
          </Label>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Журмуудын жагсаалт
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Нийтлэг {sortedPolicies.length} журм • Дундаж {avgPercent}%
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full appearance-none bg-slate-100 border border-slate-300 text-slate-700 py-2 px-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer hover:bg-slate-200 transition-colors">
                  <option value="percent">Хэрэгжилтээр</option>
                  <option value="name">Нэрээр</option>
                </select>
                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
              <button
                onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors border border-slate-300 flex items-center gap-2">
                {order === "asc" ? "↑ Өсөх" : "↓ Буурах"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    №
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Журмын нэр
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Батлагдсан
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Хэрэгжилт
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Шалгагдсан
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedPolicies.map((p: any, i: number) => (
                  <tr
                    key={p.id}
                    onClick={() => {
                      setSelectedPolicy(p);
                      //   setActiveTab("overview");
                    }}
                    className={`cursor-pointer transition-all hover:bg-blue-50 ${
                      p.validCount === 0 ? "bg-red-50/50" : ""
                    }`}>
                    <td className="px-6 py-4 text-slate-900 font-medium">
                      {i + 1}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {p.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {p.approved_date ? formatDate(p.approved_date) : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getPercentBadgeColor(
                              p.implementationPercent
                            )}`}
                            style={{
                              width: `${p.implementationPercent}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-900 min-w-12">
                          {p.implementationPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {p.validCount} / {p.checkedCount}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        className={`${getStatusColor(
                          p.implementationPercent
                        )} border transition-all duration-200`}>
                        {p.validCount > 0 ? "Үнэлгээ ✓" : "Хүлээлтэнд"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10 bg-white p-8 rounded-xl shadow-lg border border-slate-200">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">
              Хэрэгжилтийн график
            </h2>
            <p className="text-slate-500 mt-2">
              Бүх журмын хэрэгжилтийн түвшнийг харуулсан диаграмм
            </p>
          </div>
          <ResponsiveContainer width="100%" height={450}>
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                angle={-40}
                textAnchor="end"
                height={100}
                tick={{ fill: "#64748b", fontSize: 12 }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#64748b", fontSize: 12 }}
              />
              <Tooltip
                formatter={(v) => `${v}%`}
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
              />
              <Bar dataKey="Хувь" radius={[8, 8, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <PolicyDetailSheet
          policy={selectedPolicy}
          open={!!selectedPolicy}
          onOpenChange={(open) => !open && setSelectedPolicy(null)}
        />
      </div>
    </div>
  );
}
