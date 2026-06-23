"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Tablet,
  Trash2,
  Loader2,
  Monitor,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Smartphone,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

interface PairingRequest {
  id: string;
  dining_hall_id: number | null;
  chef_phone: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  assigned_uuid: string | null;
  created_at: string;
}

interface Kiosk {
  id: string;
  device_name: string;
  device_uuid: string;
  dining_hall_id: number;
  is_active: boolean;
  last_heartbeat: string | null;
}

export function KioskManager({ hallId }: { hallId: number }) {
  const supabase = createClient();

  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PairingRequest[]>([]);
  const [loadingKiosks, setLoadingKiosks] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Approve modal state
  const [approvingRequest, setApprovingRequest] =
    useState<PairingRequest | null>(null);
  const [selectedKioskId, setSelectedKioskId] = useState<string>("");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [approveMode, setApproveMode] = useState<"existing" | "new">(
    "existing",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchKiosks = useCallback(async () => {
    setLoadingKiosks(true);
    const { data } = await supabase
      .from("kiosks")
      .select("*")
      .eq("dining_hall_id", hallId)
      .order("created_at", { ascending: false });
    setKiosks(data || []);
    setLoadingKiosks(false);
  }, [hallId]);

  const fetchPendingRequests = useCallback(async () => {
    setLoadingRequests(true);
    const { data } = await supabase
      .from("kiosk_pairing_requests")
      .select("*")
      .eq("status", "pending")
      .or(`dining_hall_id.eq.${hallId},dining_hall_id.is.null`)
      .order("created_at", { ascending: false });
    setPendingRequests(data || []);
    setLoadingRequests(false);
  }, [hallId]);

  useEffect(() => {
    fetchKiosks();
    fetchPendingRequests();
  }, [fetchKiosks, fetchPendingRequests]);

  // Realtime — pending requests өөрчлөгдөхөд автоматаар шинэчлэнэ
  useEffect(() => {
    const channel = supabase
      .channel("pairing-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kiosk_pairing_requests" },
        () => fetchPendingRequests(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPendingRequests]);

  // Approve хийх
  async function handleApprove() {
    if (!approvingRequest) return;
    setIsSubmitting(true);

    try {
      let deviceUuid: string;

      if (approveMode === "existing") {
        // Байгаа киоскноос сонгох
        if (!selectedKioskId) {
          toast.error("Киоск сонгоно уу");
          return;
        }
        const kiosk = kiosks.find((k) => k.id === selectedKioskId);
        if (!kiosk) return;
        deviceUuid = kiosk.device_uuid;

        // Киоскны гал тогооны ID-г шинэчлэх (өөр гал тогоонд байсан бол)
        if (kiosk.dining_hall_id !== hallId) {
          await supabase
            .from("kiosks")
            .update({ dining_hall_id: hallId })
            .eq("id", selectedKioskId);
        }
      } else {
        // Шинэ киоск үүсгэх
        if (!newDeviceName.trim()) {
          toast.error("Төхөөрөмжийн нэр оруулна уу");
          return;
        }
        deviceUuid = crypto.randomUUID();
        const { error: insertError } = await supabase.from("kiosks").insert({
          device_name: newDeviceName.trim(),
          device_uuid: deviceUuid,
          dining_hall_id: hallId,
          is_active: true,
        });
        if (insertError) throw insertError;
      }

      // Pairing request-г approve болгох
      const { error } = await supabase
        .from("kiosk_pairing_requests")
        .update({
          status: "approved",
          assigned_uuid: deviceUuid,
          dining_hall_id: hallId,
        })
        .eq("id", approvingRequest.id);

      if (error) throw error;

      toast.success("Киоск амжилттай зөвшөөрөгдлөө");
      setApprovingRequest(null);
      setSelectedKioskId("");
      setNewDeviceName("");
      setApproveMode("existing");
      fetchKiosks();
      fetchPendingRequests();
    } catch (err: any) {
      toast.error(err.message ?? "Алдаа гарлаа");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Reject хийх
  async function handleReject(requestId: string) {
    if (!confirm("Энэ хүсэлтийг татгалзах уу?")) return;

    const { error } = await supabase
      .from("kiosk_pairing_requests")
      .update({ status: "rejected" })
      .eq("id", requestId);

    if (error) return toast.error(error.message);
    toast.success("Хүсэлт татгалзагдлаа");
    fetchPendingRequests();
  }

  // Киоск устгах
  async function handleDelete(id: string) {
    if (!confirm("Энэ киоскыг устгах уу?")) return;
    const { error } = await supabase.from("kiosks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Устгагдлаа");
    fetchKiosks();
  }

  function formatDate(str: string) {
    return new Date(str).toLocaleString("mn-MN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function heartbeatStatus(ts: string | null) {
    if (!ts) return { label: "Холбоогүй", color: "text-slate-400" };
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 2 * 60 * 1000)
      return { label: "Онлайн", color: "text-emerald-600" };
    if (diff < 10 * 60 * 1000)
      return { label: "Идэвхгүй", color: "text-amber-500" };
    return { label: "Офлайн", color: "text-red-500" };
  }

  return (
    <div className="w-full space-y-6">
      {/* ── Pending Requests ─────────────────────────────────── */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-amber-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-700">
              Холболтын хүсэлтүүд
            </h3>
            {pendingRequests.length > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                {pendingRequests.length} хүлээгдэж байна
              </span>
            )}
          </div>
          <button
            onClick={fetchPendingRequests}
            className="p-1.5 hover:bg-amber-100 rounded-lg transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
          </button>
        </div>

        {loadingRequests ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400 italic">
            Хүлээгдэж буй хүсэлт байхгүй
          </div>
        ) : (
          <div className="divide-y">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50">
                <div className="p-2 bg-amber-50 rounded-lg shrink-0">
                  <Smartphone className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">
                    {req.message || "Тайлбаргүй"}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-500 font-mono">
                      {req.chef_phone}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(req.created_at)}
                    </span>
                    {req.dining_hall_id === null && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        Гал тогоо тодорхойгүй
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs"
                    onClick={() => {
                      setApprovingRequest(req);
                      setApproveMode(kiosks.length > 0 ? "existing" : "new");
                    }}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Зөвшөөрөх
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:bg-red-50 h-8 px-3 text-xs"
                    onClick={() => handleReject(req.id)}>
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    Татгалзах
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Approve Modal ─────────────────────────────────────── */}
      {approvingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">Киоск оноох</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {approvingRequest.message || approvingRequest.chef_phone}
                </p>
              </div>
              <button
                onClick={() => setApprovingRequest(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg">
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Сонголт: байгаа / шинэ */}
              <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => setApproveMode("existing")}
                  className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    approveMode === "existing"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500"
                  }`}>
                  Байгаа киоск
                </button>
                <button
                  onClick={() => setApproveMode("new")}
                  className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    approveMode === "new"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500"
                  }`}>
                  Шинэ үүсгэх
                </button>
              </div>

              {approveMode === "existing" ? (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                    Киоск сонгох
                  </label>
                  {kiosks.length === 0 ? (
                    <p className="text-sm text-slate-400 italic py-2">
                      Энэ гал тогоонд киоск байхгүй. "Шинэ үүсгэх" ашиглана уу.
                    </p>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedKioskId}
                        onChange={(e) => setSelectedKioskId(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Сонгох --</option>
                        {kiosks.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.device_name} ({k.device_uuid.slice(0, 8)}...)
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                    Шинэ төхөөрөмжийн нэр
                  </label>
                  <Input
                    placeholder="Жишээ: Үндсэн хаалга 1"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    className="h-10"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    UUID автоматаар үүсч киоск руу илгээгдэнэ.
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setApprovingRequest(null)}
                disabled={isSubmitting}>
                Болих
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleApprove}
                disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                )}
                Зөвшөөрөх
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Холбогдсон киоскууд ───────────────────────────────── */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">
              Холбогдсон киоскууд
            </h3>
          </div>
          <button
            onClick={fetchKiosks}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b">
              <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Төхөөрөмж
              </th>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                UUID
              </th>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Төлөв
              </th>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">
                Үйлдэл
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loadingKiosks ? (
              <tr>
                <td colSpan={4} className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                </td>
              </tr>
            ) : kiosks.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-12 text-center text-slate-400 text-sm italic">
                  Холбогдсон киоск байхгүй
                </td>
              </tr>
            ) : (
              kiosks.map((kiosk) => {
                const hb = heartbeatStatus(kiosk.last_heartbeat);
                return (
                  <tr
                    key={kiosk.id}
                    className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-50 transition-colors">
                          <Tablet className="w-4 h-4 text-slate-600 group-hover:text-blue-600" />
                        </div>
                        <span className="font-semibold text-slate-700 text-sm">
                          {kiosk.device_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-[11px] bg-slate-50 px-2 py-1 rounded border text-slate-500 font-mono">
                        {kiosk.device_uuid.slice(0, 18)}...
                      </code>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`flex items-center gap-1.5 text-xs font-medium ${hb.color}`}>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            hb.label === "Онлайн"
                              ? "bg-emerald-500 animate-pulse"
                              : hb.label === "Идэвхгүй"
                                ? "bg-amber-400"
                                : "bg-red-400"
                          }`}
                        />
                        {hb.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                        onClick={() => handleDelete(kiosk.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
