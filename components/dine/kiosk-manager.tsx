"use client";

import { useState, useEffect } from "react";
import { Tablet, Trash2, Plus, Loader2, Monitor, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

export function KioskManager({ hallId }: { hallId: number }) {
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [newKiosk, setNewKiosk] = useState({
    device_name: "",
    device_uuid: "",
  });

  const supabase = createClient();

  useEffect(() => {
    if (hallId) fetchKiosks();
  }, [hallId]);

  async function fetchKiosks() {
    setLoading(true);
    const { data } = await supabase
      .from("kiosks")
      .select("*")
      .eq("dining_hall_id", hallId)
      .order("created_at", { ascending: false });
    setKiosks(data || []);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newKiosk.device_name || !newKiosk.device_uuid)
      return toast.error("Мэдээллээ гүйцэд оруулна уу");

    setIsSubmitting(true);
    const { error } = await supabase.from("kiosks").insert([
      {
        device_name: newKiosk.device_name,
        device_uuid: newKiosk.device_uuid,
        dining_hall_id: hallId,
        is_active: true,
      },
    ]);

    setIsSubmitting(false);

    if (error) {
      if (error.code === "23505")
        return toast.error("Энэ UUID бүртгэлтэй байна");
      return toast.error(error.message);
    }

    toast.success("Киоск амжилттай холбогдлоо");
    setNewKiosk({ device_name: "", device_uuid: "" });
    fetchKiosks();
  }

  async function handleDelete(id: string) {
    if (!confirm("Энэ киоскыг устгах уу?")) return;

    const { error } = await supabase.from("kiosks").delete().eq("id", id);
    if (error) return toast.error(error.message);

    toast.success("Устгагдлаа");
    fetchKiosks();
  }

  return (
    <div className="w-full space-y-6">
      {/* Input Section - Document Style */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Шинэ киоск бүртгэх
          </h3>
          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-medium">
            Hall ID: {hallId}
          </span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-medium text-slate-500 ml-1">
              Төхөөрөмжийн нэр
            </label>
            <Input
              className="h-10 border-slate-200 focus:ring-blue-500 shadow-none"
              placeholder="Жишээ: Үндсэн хаалга 1"
              value={newKiosk.device_name}
              onChange={(e) =>
                setNewKiosk({ ...newKiosk, device_name: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-medium text-slate-500 ml-1">
              UUID (Төхөөрөмжөөс хуулж тавих)
            </label>
            <Input
              className="h-10 border-slate-200 font-mono text-xs focus:ring-blue-500 shadow-none"
              placeholder="550e8400-e29b-41d4-a716-446655440000"
              value={newKiosk.device_uuid}
              onChange={(e) =>
                setNewKiosk({ ...newKiosk, device_uuid: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-3">
            <Button
              className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-md active:scale-[0.98]"
              onClick={handleAdd}
              disabled={issubmitting}>
              {issubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Киоск холбох
            </Button>
          </div>
        </div>
      </div>

      {/* List Section - Table Style */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b">
              <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Төхөөрөмж
              </th>
              <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                UUID
              </th>
              <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Төлөв
              </th>
              <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">
                Үйлдэл
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                </td>
              </tr>
            ) : kiosks.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-slate-400 text-sm italic">
                  Энэ гал тогоонд холбогдсон киоск одоогоор алга
                </td>
              </tr>
            ) : (
              kiosks.map((kiosk) => (
                <tr
                  key={kiosk.id}
                  className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-50 transition-colors">
                        <Monitor className="w-4 h-4 text-slate-600 group-hover:text-blue-600" />
                      </div>
                      <span className="font-semibold text-slate-700">
                        {kiosk.device_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-[11px] bg-slate-50 px-2 py-1 rounded border text-slate-500 font-mono">
                      {kiosk.device_uuid}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      onClick={() => handleDelete(kiosk.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 px-1">
        <Info className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[11px] text-slate-400 italic">
          Киоск дээр гарч ирж буй UUID-г энд бүртгэснээр тухайн төхөөрөмж энэ
          гал тогооны мэдээллийг татаж эхэлнэ.
        </p>
      </div>
    </div>
  );
}
