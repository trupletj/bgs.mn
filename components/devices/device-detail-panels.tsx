"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  addDeviceAssignment, removeDeviceAssignment,
  addDeviceMaintenance, deleteDeviceMaintenance, changeDeviceStatus,
} from "@/actions/devices";
import { UserSearchPicker } from "@/components/users/user-search-picker";
import type { UserSearchResult } from "@/actions/users";
import {
  DEVICE_STATUS_CONFIG, type DeviceStatus, type DeviceAssignment,
  type DeviceHistory, type DeviceMaintenance,
} from "@/types/device";
import {
  User, Search, X, Plus, Wrench, Clock, CheckCircle2,
  AlertCircle, ArrowRight, Trash2, History,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

// ─── Assignment panel ─────────────────────────────────────────────────────────

export function AssignmentPanel({ deviceId, assignments }: { deviceId: string; assignments: DeviceAssignment[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  const handleAdd = (u: UserSearchResult) => {
    startTransition(async () => {
      try {
        await addDeviceAssignment(deviceId, u.id);
        toast.success(`${u.last_name ?? ""} ${u.first_name ?? ""} нэмэгдлээ`);
        router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    startTransition(async () => {
      try {
        await removeDeviceAssignment(deviceId, removeTarget.id);
        toast.success("Хариуцагч хасагдлаа");
        setRemoveTarget(null);
        router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  };

  return (
    <>
      <div className="space-y-4">
        {/* Search */}
        <UserSearchPicker
          placeholder="Хариуцагч нэмэх (нэр, овог, утас, албан тушаал...)"
          excludeIds={assignments.map((a) => a.user_id)}
          onSelect={handleAdd}
          disabled={pending}
        />

        {/* Current assignees */}
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Хариуцагч байхгүй</p>
        ) : (
          <div className="flex flex-col gap-2">
            {assignments.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {((a.user?.last_name?.[0] ?? "") + (a.user?.first_name?.[0] ?? "")) || <User className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{a.user?.last_name} {a.user?.first_name}</p>
                  <p className="text-xs text-muted-foreground">{a.user?.position_name}</p>
                </div>
                {i === 0 && <Badge variant="outline" className="text-xs bg-primary/8 text-primary border-primary/20">Үндсэн</Badge>}
                <button onClick={() => setRemoveTarget({ id: a.id, name: `${a.user?.last_name} ${a.user?.first_name}` })}
                  className="text-muted-foreground/40 hover:text-destructive transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Хариуцагч хасах</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{removeTarget?.name}</span>-г хариуцагчдаас хасах уу?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive hover:bg-destructive/90">Хасах</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Maintenance panel ────────────────────────────────────────────────────────

export function MaintenancePanel({ deviceId, records }: { deviceId: string; records: DeviceMaintenance[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");
  const [tech, setTech] = useState("");
  const [mStatus, setMStatus] = useState<"completed" | "ongoing">("completed");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleAdd = () => {
    if (!desc.trim()) { toast.error("Тайлбар оруулна уу"); return; }
    startTransition(async () => {
      try {
        await addDeviceMaintenance({ device_id: deviceId, maintenance_date: date, description: desc, technician: tech || undefined, status: mStatus });
        toast.success("Засварын бүртгэл нэмэгдлээ");
        setDesc(""); setTech(""); setShowForm(false);
        router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteDeviceMaintenance(deviceId, deleteTarget);
        toast.success("Устгагдлаа");
        setDeleteTarget(null); router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  };

  return (
    <>
      <div className="space-y-4">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" />
          Засварын бүртгэл нэмэх
        </Button>

        {showForm && (
          <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Огноо</p>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Техникч</p>
                <Input value={tech} onChange={(e) => setTech(e.target.value)} placeholder="Нэр" className="h-9" />
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Тайлбар *</p>
                <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Засварын тайлбар..." rows={2} className="resize-none" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Статус</p>
                <Select value={mStatus} onValueChange={(v) => setMStatus(v as any)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Дууссан</SelectItem>
                    <SelectItem value="ongoing">Хийгдэж байна</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={pending}>Нэмэх</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Болих</Button>
            </div>
          </div>
        )}

        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Wrench className="mb-2 h-6 w-6 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Засварын бүртгэл байхгүй</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {records.map((r) => (
              <div key={r.id} className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{formatDate(r.maintenance_date)}</span>
                      <Badge variant="outline" className={cn("text-xs px-1.5 py-0",
                        r.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {r.status === "completed" ? "Дууссан" : "Хийгдэж байна"}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">{r.description}</p>
                    {r.technician && <p className="mt-0.5 text-xs text-muted-foreground">Техникч: {r.technician}</p>}
                  </div>
                  <button onClick={() => setDeleteTarget(r.id)} className="text-muted-foreground/40 hover:text-destructive shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Бүртгэл устгах</AlertDialogTitle>
            <AlertDialogDescription>Энэ засварын бүртгэлийг устгах уу?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Устгах</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────

export function HistoryPanel({ records }: { records: DeviceHistory[] }) {
  const ACTION_LABEL: Record<string, string> = {
    created: "Бүртгэгдлээ", assigned: "Хариуцагч нэмэгдлээ", unassigned: "Хариуцагч хасагдлаа",
    transferred: "Шилжүүлэгдлээ", status_changed: "Төлөв өөрчлөгдлөө",
    location_changed: "Байршил өөрчлөгдлөө", updated: "Засварлагдлаа", maintenance: "Засварын бүртгэл",
  };
  if (records.length === 0) return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <History className="mb-2 h-6 w-6 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">Түүх байхгүй</p>
    </div>
  );
  return (
    <div className="relative flex flex-col gap-0">
      {records.map((r, i) => (
        <div key={r.id} className="relative flex gap-3 pb-4">
          <div className="flex flex-col items-center">
            <div className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted shadow-sm">
              <div className="h-2 w-2 rounded-full bg-primary/60" />
            </div>
            {i < records.length - 1 && <div className="w-px flex-1 bg-border/50 mt-1" />}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-foreground">{ACTION_LABEL[r.action_type] ?? r.action_type}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
            {(r.old_value || r.new_value) && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                {r.old_value && <span className="line-through">{r.old_value}</span>}
                {r.old_value && r.new_value && <ArrowRight className="h-3 w-3" />}
                {r.new_value && <span className="font-medium text-foreground">{r.new_value}</span>}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground/60">
              {new Date(r.created_at).toLocaleString("mn-MN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
              {r.profile?.name && ` · ${r.profile.name}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Status change ────────────────────────────────────────────────────────────

export function StatusChangePanel({ deviceId, currentStatus }: { deviceId: string; currentStatus: DeviceStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newStatus, setNewStatus] = useState<DeviceStatus>(currentStatus);
  const [desc, setDesc] = useState("");
  const [open, setOpen] = useState(false);

  const handleChange = () => {
    if (!desc.trim()) { toast.error("Тайлбар оруулна уу"); return; }
    startTransition(async () => {
      try {
        await changeDeviceStatus(deviceId, newStatus, currentStatus, desc);
        toast.success("Төлөв өөрчлөгдлөө");
        setOpen(false); setDesc(""); router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  };

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setOpen(true)}>
        Төлөв өөрчлөх
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Төлөв өөрчлөх</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 px-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Шинэ төлөв</p>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as DeviceStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DEVICE_STATUS_CONFIG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Тайлбар *</p>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Өөрчлөлтийн шалтгаан..." rows={2} className="resize-none" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction onClick={handleChange} disabled={pending || newStatus === currentStatus}>
              Хадгалах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
