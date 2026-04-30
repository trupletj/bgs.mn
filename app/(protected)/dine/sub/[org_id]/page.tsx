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
} from "lucide-react";
import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface MealPlan {
  date: string;
  breakfast_count: number;
  lunch_count: number;
  dinner_count: number;
  night_meal_count: number;
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

  const [newCount, setNewCount] = useState(1);
  const [newLabel, setNewLabel] = useState("");
  const [newPlan, setNewPlan] = useState<MealPlan>({
    date: new Date().toISOString().split("T")[0],
    breakfast_count: 0,
    lunch_count: 0,
    dinner_count: 0,
    night_meal_count: 0,
  });

  // Ажилтан сонгох modal
  const [linkingItem, setLinkingItem] = useState<QRItem | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [linkingLoading, setLinkingLoading] = useState(false);

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
    const { data: qrs } = await supabase
      .from("sub_employee_for_food")
      .select("id, custom_label, created_at, bteg_id")
      .eq("org_id", org_id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (qrs) {
      // bteg_id байгаа бол users-с нэр татна
      const btegIds = qrs.map((q) => q.bteg_id).filter(Boolean) as string[];

      let userMap: Record<string, string> = {};
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
    if (plans) setMealPlans(plans);

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
    await supabase
      .from("sub_employee_meal_plans")
      .upsert({ org_id, ...newPlan }, { onConflict: "org_id,date" });
    await fetchData();
    setNewPlan({
      date: new Date().toISOString().split("T")[0],
      breakfast_count: 0,
      lunch_count: 0,
      dinner_count: 0,
      night_meal_count: 0,
    });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dine/sub")}
          className="p-2 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{orgName}</h1>
          <p className="text-sm text-slate-500">
            {qrItems.length} QR код үүссэн
          </p>
        </div>
      </div>

      {/* Хоолны төлөвлөгөө */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-700 mb-4">
          Хоолны төлөвлөгөө нэмэх
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
          {[
            { key: "breakfast_count", label: "Өглөө" },
            { key: "lunch_count", label: "Өдөр" },
            { key: "dinner_count", label: "Орой" },
            { key: "night_meal_count", label: "Шөнө" },
          ].map(({ key, label }) => (
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
        <button
          onClick={handleSavePlan}
          className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Save className="h-4 w-4" />
          Хадгалах
        </button>

        {mealPlans.length > 0 && (
          <div className="mt-4 border-t pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b">
                  <th className="text-left py-2">Огноо</th>
                  <th className="text-center py-2">Өглөө</th>
                  <th className="text-center py-2">Өдөр</th>
                  <th className="text-center py-2">Орой</th>
                  <th className="text-center py-2">Шөнө</th>
                </tr>
              </thead>
              <tbody>
                {mealPlans.map((plan) => (
                  <tr key={plan.date} className="border-b border-slate-50">
                    <td className="py-2 font-medium">{plan.date}</td>
                    <td className="text-center py-2">{plan.breakfast_count}</td>
                    <td className="text-center py-2">{plan.lunch_count}</td>
                    <td className="text-center py-2">{plan.dinner_count}</td>
                    <td className="text-center py-2">
                      {plan.night_meal_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
      {qrItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700">
              QR кодууд ({qrItems.length})
            </h2>
            <button
              onClick={handleDownloadAllZip}
              disabled={zipping}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
              <Archive className="h-4 w-4" />
              {zipping ? "Бэлтгэж байна..." : "ZIP татах"}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {qrItems.map((item) => (
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
              </div>
            ))}
          </div>
        </div>
      )}

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
