"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Plus,
  Download,
  Save,
  Archive,
  Link,
  X,
  Search,
  Check,
  Pencil,
  Trash2,
} from "lucide-react";
import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MealPlan {
  id?: string;
  date: string;
  breakfast_count: number;
  morning_meal_count: number;
  dining_hall_id: number | null;
  lunch_count: number;
  dinner_count: number;
  night_meal_count: number;
  actual_breakfast_count?: number;
  actual_morning_meal_count?: number;
  actual_lunch_count?: number;
  actual_dinner_count?: number;
  actual_night_meal_count?: number;
}

interface DiningHall {
  id: number;
  name: string;
}

interface QRItem {
  id: string;
  custom_label: string;
  created_at: string;
  bteg_id: string | null;
  user_name?: string | null;
}

interface User {
  id: string;
  bteg_id: string;
  first_name: string | null;
  last_name: string | null;
}

const MEAL_PLAN_FIELDS = [
  {
    key: "breakfast_count",
    actualKey: "actual_breakfast_count",
    label: "Өглөөний цай",
    shortLabel: "Ө/цай",
    mealType: "breakfast",
  },
  {
    key: "morning_meal_count",
    actualKey: "actual_morning_meal_count",
    label: "Өглөөний хоол",
    shortLabel: "Ө/хоол",
    mealType: "morning_meal",
  },
  {
    key: "lunch_count",
    actualKey: "actual_lunch_count",
    label: "Өдрийн хоол",
    shortLabel: "Өдөр",
    mealType: "lunch",
  },
  {
    key: "dinner_count",
    actualKey: "actual_dinner_count",
    label: "Оройн хоол",
    shortLabel: "Орой",
    mealType: "dinner",
  },
  {
    key: "night_meal_count",
    actualKey: "actual_night_meal_count",
    label: "Шөнийн хоол",
    shortLabel: "Шөнө",
    mealType: "night_meal",
  },
] as const;

function createEmptyPlan(): MealPlan {
  return {
    date: new Date().toISOString().split("T")[0],
    dining_hall_id: null,
    breakfast_count: 0,
    morning_meal_count: 0,
    lunch_count: 0,
    dinner_count: 0,
    night_meal_count: 0,
  };
}

function planActualKey(
  date: string,
  diningHallId: number | null,
  mealType: string,
) {
  return `${date}|${diningHallId ?? ""}|${mealType}`;
}

function getActualMealLogWeight(isExtraServing: boolean | null): number {
  return isExtraServing ? 0.5 : 1;
}

function formatMealCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getPlanSummary(plan: MealPlan) {
  return MEAL_PLAN_FIELDS.reduce(
    (summary, field) => {
      const planned = Number(plan[field.key] || 0);
      const actual = Number(plan[field.actualKey] || 0);

      return {
        planned: summary.planned + planned,
        actual: summary.actual + actual,
      };
    },
    { planned: 0, actual: 0 },
  );
}

// QR утга үүсгэх
function buildQRValue(item: QRItem): string {
  return JSON.stringify({
    sub_id: item.id,
    bteg_id: item.bteg_id ?? null,
  });
}

// QR + label canvas үүсгэх
async function generateQRCanvas(item: QRItem): Promise<HTMLCanvasElement> {
  const qrCanvas = document.createElement("canvas");
  const qrSize = 300;

  await QRCode.toCanvas(qrCanvas, buildQRValue(item), {
    width: qrSize,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const padding = 16;
  const labelHeight = 56;
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = qrSize + padding * 2;
  finalCanvas.height = qrSize + labelHeight + padding * 2;

  const ctx = finalCanvas.getContext("2d");
  if (!ctx) return finalCanvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
  ctx.drawImage(qrCanvas, padding, padding);

  // Custom label
  ctx.fillStyle = "#000000";
  ctx.font = "bold 15px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    item.custom_label,
    finalCanvas.width / 2,
    qrSize + padding + 24,
    finalCanvas.width - padding * 2,
  );

  // Холбосон ажилтны нэр
  if (item.user_name) {
    ctx.font = "13px Arial";
    ctx.fillStyle = "#555555";
    ctx.fillText(
      item.user_name,
      finalCanvas.width / 2,
      qrSize + padding + 44,
      finalCanvas.width - padding * 2,
    );
  }

  return finalCanvas;
}

export default function OrgDetailPage() {
  const { org_id } = useParams<{ org_id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [orgName, setOrgName] = useState("");
  const [qrItems, setQrItems] = useState<QRItem[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [deletingQrId, setDeletingQrId] = useState<string | null>(null);
  const [diningHalls, setDiningHalls] = useState<DiningHall[]>([]);

  const [newCount, setNewCount] = useState(1);
  const [newLabel, setNewLabel] = useState("");
  const [newPlan, setNewPlan] = useState<MealPlan>(() => createEmptyPlan());
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState("");
  const [qrSearch, setQrSearch] = useState("");
  const [activeTab, setActiveTab] = useState("plans");

  // Ажилтан сонгох modal
  const [linkingItem, setLinkingItem] = useState<QRItem | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [linkingLoading, setLinkingLoading] = useState(false);

  useEffect(() => {
    const fetchDiningHalls = async () => {
      const { data, error } = await supabase
        .from("dining_hall")
        .select("id, name")
        .order("name");

      if (error) {
        console.error("Error fetching dining halls:", error);
      } else {
        setDiningHalls(data || []);
      }
    };

    fetchDiningHalls();
  }, []);

  useEffect(() => {
    fetchData();
  }, [org_id]);

  async function fetchData() {
    setLoading(true);

    const { data: org } = await supabase
      .from("organization")
      .select("name, bteg_id")
      .eq("id", org_id)
      .single();

    if (org) {
      setOrgName(org.name);
      setNewLabel(org.name);

      // Тухайн org-д хамаарах users татах
      const { data: orgUsers } = await supabase
        .from("users")
        .select("id, bteg_id, first_name, last_name")
        .eq("organization_id", org.bteg_id)
        .eq("is_active", true)
        .order("last_name");

      if (orgUsers) setUsers(orgUsers);
    }

    // QR жагсаалт + холбосон ажилтны нэр
    const { data: rawQrs } = await supabase
      .from("sub_employee_for_food")
      .select("id, custom_label, created_at, bteg_id")
      .eq("org_id", org_id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    const qrs = rawQrs || [];
    if (qrs) {
      // bteg_id байгаа бол users-с нэр татна
      const btegIds = qrs.map((q) => q.bteg_id).filter(Boolean) as string[];

      const userMap: Record<string, string> = {};
      if (btegIds.length > 0) {
        const { data: linkedUsers } = await supabase
          .from("users")
          .select("bteg_id, first_name, last_name")
          .in("bteg_id", btegIds);

        if (linkedUsers) {
          linkedUsers.forEach((u) => {
            userMap[u.bteg_id] =
              `${u.last_name ?? ""} ${u.first_name ?? ""}`.trim();
          });
        }
      }

      setQrItems(
        qrs.map((q) => ({
          ...q,
          user_name: q.bteg_id ? (userMap[q.bteg_id] ?? null) : null,
        })),
      );
    }

    const { data: plans } = await supabase
      .from("sub_employee_meal_plans")
      .select("*")
      .eq("org_id", org_id)
      .order("date", { ascending: false });
    if (plans) {
      const typedPlans = plans as MealPlan[];
      const planDates = Array.from(
        new Set(typedPlans.map((plan) => plan.date)),
      );
      const hallIds = Array.from(
        new Set(
          typedPlans
            .map((plan) => plan.dining_hall_id)
            .filter((hallId): hallId is number => typeof hallId === "number"),
        ),
      );

      const actualCounts: Record<string, number> = {};
      if (planDates.length > 0 && hallIds.length > 0) {
        const { data: actualLogs, error: actualLogsError } = await supabase
          .from("meal_logs")
          .select(
            "date, dining_hall_id, meal_type, is_extra_serving, sub_employee_for_food!inner(org_id)",
          )
          .eq("sub_employee_for_food.org_id", org_id)
          .in("date", planDates)
          .in("dining_hall_id", hallIds);

        if (actualLogsError) {
          console.error(
            "Error fetching sub employee actual logs:",
            actualLogsError,
          );
        } else {
          (actualLogs || []).forEach((log) => {
            const key = planActualKey(
              log.date,
              log.dining_hall_id,
              log.meal_type,
            );
            actualCounts[key] =
              (actualCounts[key] || 0) +
              getActualMealLogWeight(log.is_extra_serving);
          });
        }
      }

      setMealPlans(
        typedPlans.map((plan) => ({
          ...plan,
          morning_meal_count: Number(plan.morning_meal_count || 0),
          actual_breakfast_count:
            actualCounts[
              planActualKey(plan.date, plan.dining_hall_id, "breakfast")
            ] || 0,
          actual_morning_meal_count:
            actualCounts[
              planActualKey(plan.date, plan.dining_hall_id, "morning_meal")
            ] || 0,
          actual_lunch_count:
            actualCounts[
              planActualKey(plan.date, plan.dining_hall_id, "lunch")
            ] || 0,
          actual_dinner_count:
            actualCounts[
              planActualKey(plan.date, plan.dining_hall_id, "dinner")
            ] || 0,
          actual_night_meal_count:
            actualCounts[
              planActualKey(plan.date, plan.dining_hall_id, "night_meal")
            ] || 0,
        })),
      );
    }

    setLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    const startIndex = qrItems.length + 1;

    const { data } = await supabase
      .from("sub_employee_for_food")
      .insert(
        Array.from({ length: newCount }).map((_, i) => ({
          org_id,
          bteg_id: null,
          custom_label: `${newLabel} - ${String(startIndex + i).padStart(3, "0")}`,
        })),
      )
      .select("id, custom_label, created_at, bteg_id");

    if (data) {
      setQrItems((prev) => [
        ...prev,
        ...data.map((d) => ({ ...d, user_name: null })),
      ]);
    }
    setGenerating(false);
  }

  async function handleSavePlan() {
    if (!newPlan.dining_hall_id) {
      toast.warning("Гал тогоо сонгоно уу!");
      return;
    }
    const payload = {
      org_id,
      date: newPlan.date,
      dining_hall_id: newPlan.dining_hall_id,
      breakfast_count: newPlan.breakfast_count,
      morning_meal_count: newPlan.morning_meal_count,
      lunch_count: newPlan.lunch_count,
      dinner_count: newPlan.dinner_count,
      night_meal_count: newPlan.night_meal_count,
    };

    const { error } = editingPlanId
      ? await supabase
          .from("sub_employee_meal_plans")
          .update(payload)
          .eq("id", editingPlanId)
      : await supabase
          .from("sub_employee_meal_plans")
          .upsert(payload, { onConflict: "org_id,dining_hall_id,date" });

    if (!error) {
      await fetchData();
      setNewPlan(createEmptyPlan());
      setEditingPlanId(null);
      toast.success(
        editingPlanId ? "Төлөвлөгөө шинэчлэгдлээ" : "Төлөвлөгөө хадгалагдлаа",
      );
    } else {
      toast.error(error.message);
    }
  }

  function handleEditPlan(plan: MealPlan) {
    setEditingPlanId(plan.id || null);
    setNewPlan({
      id: plan.id,
      date: plan.date,
      dining_hall_id: plan.dining_hall_id,
      breakfast_count: Number(plan.breakfast_count || 0),
      morning_meal_count: Number(plan.morning_meal_count || 0),
      lunch_count: Number(plan.lunch_count || 0),
      dinner_count: Number(plan.dinner_count || 0),
      night_meal_count: Number(plan.night_meal_count || 0),
    });
  }

  function cancelEditPlan() {
    setEditingPlanId(null);
    setNewPlan(createEmptyPlan());
  }

  // Ажилтан холбох
  async function handleLinkUser(user: User) {
    if (!linkingItem) return;
    setLinkingLoading(true);

    const { error } = await supabase
      .from("sub_employee_for_food")
      .update({ bteg_id: user.bteg_id })
      .eq("id", linkingItem.id);

    if (!error) {
      const userName =
        `${user.last_name ?? ""} ${user.first_name ?? ""}`.trim();
      setQrItems((prev) =>
        prev.map((q) =>
          q.id === linkingItem.id
            ? { ...q, bteg_id: user.bteg_id, user_name: userName }
            : q,
        ),
      );
      setLinkingItem(null);
      setUserSearch("");
    }
    setLinkingLoading(false);
  }

  // Холболт цуцлах
  async function handleUnlinkUser(item: QRItem) {
    const { error } = await supabase
      .from("sub_employee_for_food")
      .update({ bteg_id: null })
      .eq("id", item.id);

    if (!error) {
      setQrItems((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, bteg_id: null, user_name: null } : q,
        ),
      );
    }
  }

  async function handleSoftDeleteQR(item: QRItem) {
    const confirmed = window.confirm(
      `"${item.custom_label}" QR кодыг устгах уу?`,
    );
    if (!confirmed) return;

    setDeletingQrId(item.id);
    const { error } = await supabase
      .from("sub_employee_for_food")
      .update({ is_active: false })
      .eq("id", item.id);

    if (error) {
      toast.error(error.message);
    } else {
      setQrItems((prev) => prev.filter((q) => q.id !== item.id));
      if (linkingItem?.id === item.id) {
        setLinkingItem(null);
        setUserSearch("");
      }
      toast.success("QR код устгагдлаа");
    }

    setDeletingQrId(null);
  }

  async function handleDownloadQR(item: QRItem) {
    const canvas = await generateQRCanvas(item);
    const link = document.createElement("a");
    link.download = `${item.custom_label}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }

  async function handleDownloadAllZip() {
    setZipping(true);
    const zip = new JSZip();
    const folder = zip.folder(orgName) ?? zip;

    for (const item of qrItems) {
      const canvas = await generateQRCanvas(item);
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95);
      });
      folder.file(`${item.custom_label}.jpg`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `${orgName}-QR кодууд.zip`);
    setZipping(false);
  }

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.bteg_id.toLowerCase().includes(q) ||
      `${u.last_name ?? ""} ${u.first_name ?? ""}`.toLowerCase().includes(q)
    );
  });

  const planQuery = planFilter.trim().toLowerCase();
  const filteredPlans = planQuery
    ? mealPlans.filter((plan) => {
        const hallName =
          diningHalls.find((hall) => hall.id === plan.dining_hall_id)?.name ??
          "";
        return (
          plan.date.toLowerCase().includes(planQuery) ||
          hallName.toLowerCase().includes(planQuery)
        );
      })
    : mealPlans;

  const qrQuery = qrSearch.trim().toLowerCase();
  const filteredQrItems = qrQuery
    ? qrItems.filter(
        (item) =>
          item.custom_label.toLowerCase().includes(qrQuery) ||
          (item.user_name ?? "").toLowerCase().includes(qrQuery),
      )
    : qrItems;

  const linkedQrCount = qrItems.filter((item) => item.bteg_id).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dine/sub")}
          className="p-2 hover:bg-slate-100 rounded-lg shrink-0">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800 truncate">
            {orgName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {qrItems.length} QR код
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
              {linkedQrCount} холбосон
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
              {mealPlans.length} төлөвлөгөө
            </span>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="gap-4">
        <TabsList className="sticky top-0 z-20 w-full justify-start sm:w-fit">
          <TabsTrigger value="plans">Хоолны төлөвлөгөө</TabsTrigger>
          <TabsTrigger value="qr">QR кодууд ({qrItems.length})</TabsTrigger>
        </TabsList>

        {/* === Хоолны төлөвлөгөөний таб === */}
        <TabsContent value="plans" className="space-y-5">
          {/* Хоолны төлөвлөгөө нэмэх/засах */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-semibold text-slate-700 mb-4">
              {editingPlanId
                ? "Хоолны төлөвлөгөө засах"
                : "Хоолны төлөвлөгөө нэмэх"}
            </h2>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Огноо</label>
            <input
              type="date"
              value={newPlan.date}
              onChange={(e) =>
                setNewPlan((p) => ({ ...p, date: e.target.value }))
              }
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Гал тогоо
            </label>
            <select
              value={newPlan.dining_hall_id ?? ""}
              onChange={(e) =>
                setNewPlan((p) => ({
                  ...p,
                  dining_hall_id: e.target.value
                    ? Number(e.target.value)
                    : null,
                }))
              }
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Сонгох...</option>
              {diningHalls.map((hall) => (
                <option key={hall.id} value={hall.id}>
                  {hall.name}
                </option>
              ))}
            </select>
          </div>
          {MEAL_PLAN_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-slate-500 mb-1 block">
                {label}
              </label>
              <input
                type="number"
                min={0}
                value={newPlan[key as keyof MealPlan] as number}
                onChange={(e) =>
                  setNewPlan((p) => ({
                    ...p,
                    [key]: parseInt(e.target.value) || 0,
                  }))
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={handleSavePlan}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Save className="h-4 w-4" />
            {editingPlanId ? "Шинэчлэх" : "Хадгалах"}
          </button>
          {editingPlanId && (
            <button
              onClick={cancelEditPlan}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
              <X className="h-4 w-4" />
              Болих
            </button>
          )}
        </div>

          </div>

          {/* Хадгалсан төлөвлөгөө */}
          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-700">
                  Хадгалсан төлөвлөгөө ({mealPlans.length})
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Нүд бүр: захиалсан / <span className="text-blue-700">идсэн</span>{" "}
                  / зөрүү
                </p>
              </div>
              {mealPlans.length > 0 && (
                <div className="relative sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    placeholder="Огноо / гал тогоогоор шүүх..."
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {mealPlans.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                Одоогоор төлөвлөгөө алга байна.
              </p>
            ) : filteredPlans.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                Илэрц олдсонгүй.
              </p>
            ) : (
              <div className="max-h-[72vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="border-b text-xs text-slate-500">
                      <th className="px-4 py-2.5 text-left">Огноо</th>
                      <th className="px-2 py-2.5 text-left">Гал тогоо</th>
                      {MEAL_PLAN_FIELDS.map((field) => (
                        <th
                          key={field.key}
                          className="min-w-16 px-2 py-2.5 text-center font-semibold text-slate-700">
                          {field.shortLabel}
                        </th>
                      ))}
                      <th className="px-2 py-2.5 text-right">Нийт</th>
                      <th className="px-4 py-2.5 text-right">Үйлдэл</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlans.map((plan) => {
                      const planSummary = getPlanSummary(plan);
                      const diff = planSummary.actual - planSummary.planned;

                      return (
                        <tr
                          key={plan.id || `${plan.date}-${plan.dining_hall_id}`}
                          className="border-b border-slate-100 hover:bg-slate-50/60">
                          <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                            {plan.date}
                          </td>
                          <td className="px-2 py-2.5 whitespace-nowrap">
                            {diningHalls.find(
                              (hall) => hall.id === plan.dining_hall_id,
                            )?.name || `#${plan.dining_hall_id}`}
                          </td>
                          {MEAL_PLAN_FIELDS.map((field) => {
                            const planned = Number(plan[field.key] || 0);
                            const actual = Number(plan[field.actualKey] || 0);
                            const mealDiff = actual - planned;

                            return (
                              <td
                                key={field.key}
                                className="px-2 py-2.5 text-center">
                                <div className="leading-tight whitespace-nowrap">
                                  <span className="text-slate-500">
                                    {formatMealCount(planned)}
                                  </span>
                                  <span className="text-slate-300"> / </span>
                                  <span className="font-semibold text-blue-700">
                                    {formatMealCount(actual)}
                                  </span>
                                  {mealDiff !== 0 && (
                                    <div
                                      className={`text-[11px] ${mealDiff > 0 ? "text-amber-600" : "text-rose-600"}`}>
                                      {mealDiff > 0 ? "+" : ""}
                                      {formatMealCount(mealDiff)}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-2 py-2.5 text-right whitespace-nowrap">
                            <div className="leading-tight">
                              <span className="text-slate-500">
                                {formatMealCount(planSummary.planned)}
                              </span>
                              <span className="text-slate-300"> / </span>
                              <span className="font-semibold text-blue-700">
                                {formatMealCount(planSummary.actual)}
                              </span>
                              {diff !== 0 && (
                                <div
                                  className={`text-[11px] ${diff > 0 ? "text-amber-600" : "text-rose-600"}`}>
                                  {diff > 0 ? "+" : ""}
                                  {formatMealCount(diff)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleEditPlan(plan)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">
                              <Pencil className="h-3 w-3" />
                              Засах
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* === QR кодуудын таб === */}
        <TabsContent value="qr" className="space-y-5">

      {/* QR үүсгэх */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-700 mb-4">Шинэ QR үүсгэх</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="text-xs text-slate-500 mb-1 block">Шошго</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="w-28">
            <label className="text-xs text-slate-500 mb-1 block">Тоо</label>
            <input
              type="number"
              min={1}
              value={newCount}
              onChange={(e) => setNewCount(parseInt(e.target.value) || 1)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            <Plus className="h-4 w-4" />
            {generating ? "Үүсгэж байна..." : "Үүсгэх"}
          </button>
        </div>
      </div>

        {/* QR жагсаалт */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-slate-700">
              QR кодууд ({qrItems.length})
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {qrItems.length > 0 && (
                <div className="relative sm:w-56">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={qrSearch}
                    onChange={(e) => setQrSearch(e.target.value)}
                    placeholder="Шошго / ажилтнаар хайх..."
                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <button
                onClick={handleDownloadAllZip}
                disabled={zipping || qrItems.length === 0}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                <Archive className="h-4 w-4" />
                {zipping ? "Бэлтгэж байна..." : "ZIP татах"}
              </button>
            </div>
          </div>

          {qrItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Одоогоор QR код алга. Дээрх талбараас үүсгэнэ үү.
            </p>
          ) : filteredQrItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Илэрц олдсонгүй.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {filteredQrItems.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-3 flex flex-col items-center gap-2">
                {/* QR дээр дарахад холбох modal нээнэ */}
                <button
                  onClick={() => {
                    setLinkingItem(item);
                    setUserSearch("");
                  }}
                  className="relative group">
                  <QRCodeSVG value={buildQRValue(item)} size={120} level="H" />
                  <div className="absolute inset-0 bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Link className="h-6 w-6 text-white" />
                  </div>
                </button>

                <p className="text-xs font-bold text-center">
                  {item.custom_label}
                </p>

                {/* Холбосон ажилтан */}
                {item.user_name ? (
                  <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    <Check className="h-3 w-3" />
                    <span className=" max-w-[100px]">{item.user_name}</span>
                    <button
                      onClick={() => handleUnlinkUser(item)}
                      className="ml-1 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Холбоогүй</span>
                )}

                <button
                  onClick={() => handleDownloadQR(item)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <Download className="h-3 w-3" />
                  JPEG татах
                </button>
                <button
                  onClick={() => handleSoftDeleteQR(item)}
                  disabled={deletingQrId === item.id}
                  className="flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50">
                  <Trash2 className="h-3 w-3" />
                  {deletingQrId === item.id ? "Устгаж байна..." : "Устгах"}
                </button>
              </div>
            ))}
            </div>
          )}
        </div>
        </TabsContent>
      </Tabs>

      {/* Ажилтан сонгох Modal */}
      {linkingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold text-slate-800">Ажилтан холбох</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {linkingItem.custom_label}
                </p>
              </div>
              <button
                onClick={() => {
                  setLinkingItem(null);
                  setUserSearch("");
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Нэр эсвэл bteg_id-аар хайх..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1">
                {filteredUsers.length === 0 ? (
                  <p className="text-center text-slate-400 py-6 text-sm">
                    Илэрц олдсонгүй
                  </p>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleLinkUser(user)}
                      disabled={linkingLoading}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors text-left disabled:opacity-50">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {`${user.last_name ?? ""} ${user.first_name ?? ""}`.trim() ||
                            "—"}
                        </p>
                        <p className="text-xs text-slate-400">{user.bteg_id}</p>
                      </div>
                      {linkingItem.bteg_id === user.bteg_id && (
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
