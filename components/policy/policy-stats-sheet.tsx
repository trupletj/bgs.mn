// components/policy-detail-sheet.tsx
"use client";

import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle, // ← ЭНД БАЙГАА!
} from "@/components/ui/sheet";
import { FileText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const actionTypes = [
  { value: "IMPLEMENTATION", label: "Хэрэгжүүлэлт" },
  { value: "MONITORING", label: "Хяналт" },
  { value: "VERIFICATION", label: "Баталгаажуулалт" },
  { value: "DEPLOYMENT", label: "Нэвтрүүлэлт" },
] as const;

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

function TabButton({
  active,
  onClick,
  children,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-8 py-5 font-semibold transition-all border-b-4 whitespace-nowrap ${
        active
          ? "border-blue-600 text-blue-600 bg-blue-50"
          : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      }`}>
      <Icon className="w-5 h-5" />
      {children}
    </button>
  );
}

interface PolicyDetailSheetProps {
  policy: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PolicyDetailSheet({
  policy,
  open,
  onOpenChange,
}: PolicyDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "clauses">(
    "overview",
  );

  if (!policy) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl p-0 flex flex-col">
        {/* Header - SheetTitle заавал байх ёстой! */}
        <SheetHeader className="sticky top-0 z-20 bg-white border-b border-slate-200 px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              {/* Заавал SheetTitle ашигла! */}
              <SheetTitle className="text-3xl font-bold text-slate-900">
                {policy.name}
              </SheetTitle>
              <div className="flex flex-wrap gap-6 mt-5">
                <div className="flex items-center gap-3">
                  <span className="text-slate-600 font-medium">Хэрэгжилт:</span>
                  <Badge
                    variant={
                      policy.implementationPercent >= 90
                        ? "default"
                        : "secondary"
                    }
                    className="text-lg px-5 py-2 font-bold">
                    {policy.implementationPercent}%
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-600 font-medium">Үнэлгээ:</span>
                  <span className="text-lg font-bold text-slate-800">
                    {policy.validCount} / {policy.checkedCount}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="rounded-full hover:bg-slate-100">
              <X className="w-6 h-6" />
            </Button>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
          <div className="flex">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              icon={FileText}>
              Үзүүлэлт
            </TabButton>
            <TabButton
              active={activeTab === "clauses"}
              onClick={() => setActiveTab("clauses")}
              icon={Users}>
              Заалтууд ({policy.clauses?.length || 0})
            </TabButton>
          </div>
        </div>

        {/* ЗӨВХӨН ТАБААС ХАМААРЧ КОНТЕНТ ХАРУУЛНА */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
          {activeTab === "overview" && (
            <div className="px-10 py-5 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center p-10 bg-gradient-to-br from-blue-50 to-blue-100 rounded-3xl border-2 border-blue-200">
                  <p className="text-blue-600 font-bold uppercase tracking-wider mb-4">
                    Нийт заалт
                  </p>
                  <p className="text-5xl font-bold text-blue-900">
                    {policy.clauses?.length || 0}
                  </p>
                </div>
                <div className="text-center p-10 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-3xl border-2 border-emerald-200">
                  <p className="text-emerald-600 font-bold uppercase tracking-wider mb-4">
                    Хэрэгжилт
                  </p>
                  <p className="text-5xl font-bold text-emerald-900">
                    {policy.implementationPercent}%
                  </p>
                </div>
                <div className="text-center p-10 bg-gradient-to-br from-amber-50 to-amber-100 rounded-3xl border-2 border-amber-200">
                  <p className="text-amber-600 font-bold uppercase tracking-wider mb-4">
                    Үнэлгээ
                  </p>
                  <p className="text-5xl font-bold text-amber-900">
                    {policy.validCount}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-6">Хэрэгжилтийн явц</h3>
                <div className="w-full bg-slate-200 rounded-full h-8 overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${policy.implementationPercent}%`,
                      backgroundColor:
                        policy.implementationPercent >= 90
                          ? "#10b981"
                          : policy.implementationPercent >= 70
                            ? "#f59e0b"
                            : "#ef4444",
                    }}
                  />
                </div>
                <p className="text-right mt-4 text-lg font-bold text-slate-700">
                  {policy.implementationPercent}% хүрсэн
                </p>
              </div>
            </div>
          )}

          {activeTab === "clauses" && (
            <div className="px-10 pt-5 pb-32">
              <h3 className="text-2xl font-bold mb-6">
                Үнэлгээ хийгдсэн заалтууд
              </h3>

              {policy.clauses && policy.clauses.length > 0 ? (
                <Accordion type="single" collapsible className="space-y-6">
                  {sortByReferenceNumber(policy.clauses).map((clause: any) => (
                    <AccordionItem
                      key={clause.id}
                      value={clause.id}
                      className="border-2 border-slate-300 rounded-2xl overflow-hidden bg-white shadow-lg hover:shadow-2xl transition-all">
                      <AccordionTrigger className="px-8 py-6 hover:no-underline bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex w-full items-center justify-between text-left">
                          <div className="flex items-center gap-6">
                            <span className="font-mono text-xl font-bold text-blue-700">
                              {clause.reference_number}
                            </span>
                            <span className="text-base font-medium text-slate-700">
                              {clause.text}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className="font-bold text-lg ml-2 px-5 py-2">
                            {clause.jobPositions.length} байр
                          </Badge>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="bg-white border-t-2 border-slate-200">
                        <div className="p-8 space-y-8">
                          <div className="overflow-x-auto rounded-xl border-2 border-slate-200">
                            <table className="w-full">
                              <thead className="bg-gradient-to-r from-slate-100 to-slate-200">
                                <tr>
                                  <th className="text-left px-6 py-4 font-bold">
                                    Ажлын байр
                                  </th>
                                  <th className="text-left px-6 py-4 font-bold">
                                    Төрөл
                                  </th>
                                  <th className="text-center px-6 py-4 font-bold">
                                    Оноо
                                  </th>
                                  <th className="text-left px-6 py-4 font-bold">
                                    Тайлбар
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {clause.jobPositions.map((jp: any) => {
                                  const typeLabel =
                                    actionTypes.find((t) => t.value === jp.type)
                                      ?.label ||
                                    jp.type ||
                                    "Тодорхойгүй";
                                  const score = jp.rating?.score;

                                  return (
                                    <tr
                                      key={jp.id}
                                      className="hover:bg-blue-50">
                                      <td className="px-6 py-4 font-medium text-slate-900">
                                        {jp.name}
                                      </td>
                                      <td className="px-6 py-4">
                                        <Badge variant="outline">
                                          {typeLabel}
                                        </Badge>
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                        {score !== undefined ? (
                                          <span
                                            className={`px-5 py-2 rounded-full text-white font-bold text-lg ${
                                              score >= 5
                                                ? "bg-emerald-500"
                                                : score >= 3
                                                  ? "bg-amber-500"
                                                  : "bg-red-500"
                                            }`}>
                                            {score}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400">
                                            Үнэлгээгүй
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 text-slate-600 max-w-lg">
                                        {jp.rating?.description || "-"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-24 text-slate-500">
                  <p className="text-2xl font-medium">
                    Заалт байхгүй эсвэл үнэлгээ хийгдээгүй байна.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
