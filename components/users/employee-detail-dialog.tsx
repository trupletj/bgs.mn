"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone,
  Building2,
  LinkIcon,
  Building,
  Clock,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { UserMealConfig } from "../dine/user-meal-config";
import { RiProfileLine } from "react-icons/ri";
import { DialogDescription } from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import type { Dispatch } from "react";
import {
  getEmployeeShiftInfo,
  type EmployeeShiftInfo,
} from "@/actions/employee-shift";

interface EmployeeDialogData {
  id: string;
  bteg_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  register_number?: string | null;
  department_name?: string | null;
  heltes_name?: string | null;
  position_name?: string | null;
  is_active?: boolean | null;
  organization_name?: string | null;
  address?: string | null;
  email?: string | null;
  job_position_id?: string | null;
}

interface EmployeeDetailDialogProps {
  employee: EmployeeDialogData | null;
  open: boolean;
  onOpenChange: Dispatch<boolean>;
  permissions: {
    canReadUserDetail: boolean;
    canReadDine: boolean;
    canEditDine: boolean;
    canManageActions: boolean;
  };
}

export function EmployeeDetailDialog({
  employee,
  open,
  onOpenChange,
  permissions,
}: EmployeeDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("");
  const [shiftInfo, setShiftInfo] = useState<EmployeeShiftInfo | null>(null);
  const [isShiftLoading, setIsShiftLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setActiveTab("");
      setShiftInfo(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !employee?.bteg_id) {
      setShiftInfo(null);
      return;
    }

    let cancelled = false;
    setIsShiftLoading(true);
    getEmployeeShiftInfo(employee.bteg_id)
      .then((result) => {
        if (!cancelled) setShiftInfo(result);
      })
      .finally(() => {
        if (!cancelled) setIsShiftLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employee?.bteg_id, open]);

  if (!employee) return null;
  const supabase = createClient();

  const formatShiftTime = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(String(value).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  function getHeltesAndDepartment(
    dep_name: string | null,
    heltes_name: string | null,
  ) {
    if (!dep_name && !heltes_name) return "Мэдээлэл алга";
    if (!dep_name) return heltes_name;
    if (!heltes_name) return dep_name;
    return `${heltes_name}, ${dep_name}`;
  }

  const handleNavigateJobDesc = async (job_position_id_bteg: string | null) => {
    if (!job_position_id_bteg) {
      toast.error("Албан тушаалын мэдээлэл олдсонгүй");
      return;
    }

    try {
      // 2. job_positions-оос ID-г нь авах
      const { data: jobPos, error: posError } = await supabase
        .from("job_position")
        .select("id")
        .eq("bteg_id", job_position_id_bteg)
        .single();

      if (posError || !jobPos) throw new Error("Албан тушаал олдсонгүй");

      // 3. job_descriptions-оос тухайн position-д хамаарах ID-г авах
      const { data: jobDesc, error: descError } = await supabase
        .from("job_description")
        .select("id")
        .eq("job_position_id", jobPos.id)
        .single();

      if (descError || !jobDesc) throw new Error("Тодорхойлолт олдсонгүй");

      const url = `/job-descriptions/${jobDesc.id}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Алдаа гарлаа");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] flex-col overflow-y-auto sm:max-w-[56vw] [scrollbar-gutter:stable]">
        <div className="shrink-0">
          <DialogHeader>
            <DialogTitle className="sr-only">Ажилтны мэдээлэл</DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">
            Ажилтны талаарх мэдээллүүд агуулагдана
          </DialogDescription>

          {/* Employee card header */}
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
                {(employee.last_name?.[0] ?? "") + (employee.first_name?.[0] ?? "")}
              </div>

              {/* Name + status */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">
                    {employee.last_name} {employee.first_name}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Идэвхтэй
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
                    <Clock className="h-3 w-3" />
                    {isShiftLoading
                      ? "Ээлж ачаалж байна"
                      : shiftInfo?.currentGroupName ||
                        shiftInfo?.shiftType ||
                        "Ээлж тодорхойгүй"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {employee.position_name || "Албан тушаал тодорхойгүй"}
                </p>
              </div>
            </div>

            {/* Info grid */}
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border/60 pt-4 sm:grid-cols-3">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  {employee.organization_name || "Байгууллага тодорхойгүй"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  {employee.department_name || employee.heltes_name || "Хэлтэс тодорхойгүй"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-mono text-muted-foreground">
                  {employee.phone || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm sm:col-span-3">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  {shiftInfo
                    ? `${shiftInfo.shiftType || "Ээлж"} · ${formatShiftTime(
                        shiftInfo.startAt,
                      )} - ${formatShiftTime(shiftInfo.endAt)}`
                    : isShiftLoading
                      ? "Ээлжийн мэдээлэл ачаалж байна"
                      : "Ээлжийн мэдээлэл олдсонгүй"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 ">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              {permissions.canReadUserDetail && (
                <TabsTrigger value="overview">Ерөнхий</TabsTrigger>
              )}
              {permissions.canReadDine && (
                <TabsTrigger value="dining_halls">Гал тогоо</TabsTrigger>
              )}
              {/* <TabsTrigger value="attendance">Ирц / Түүх</TabsTrigger> */}
              {/* <TabsTrigger value="actions">Үйлдэл</TabsTrigger> */}
            </TabsList>

            <TabsContent
              value="overview"
              className="p-4 border rounded-b-md mt-2 space-y-4">
              {/* Энд ажилтны бусад хувийн мэдээллүүдийг харуулж болно */}
              <h3 className="font-medium flex items-center gap-2 text-sm">
                <RiProfileLine className="h-4 w-4 text-primary shrink-0" />
                <span>Дэлгэрэнгүй мэдээлэл</span>
              </h3>
              <div className="grid md:grid-cols-4 grid-cols-2 text-left gap-y-4 gap-x-6 text-sm">
                {/* Овог */}
                <div className="flex gap-2">
                  <span className="font-semibold">Овог:</span>
                  <span className="">{employee.last_name}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold">Нэр:</span>
                  <span className="">{employee.first_name}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold">РД:</span>
                  <span className="">{employee.register_number}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold">Төлөв:</span>
                  <div>
                    {employee.is_active ? (
                      <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Идэвхтэй
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Идэвхгүй
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 col-span-2">
                  <span className="font-semibold">Байгууллага:</span>
                  <span>{employee.organization_name || "Мэдээлэл алга"}</span>
                </div>
                <div className="flex gap-2 col-span-2">
                  <span className="font-semibold ">Алба, Хэлтэс:</span>
                  <span className="">
                    {getHeltesAndDepartment(
                      employee.department_name ?? null,
                      employee.heltes_name ?? null,
                    )}
                  </span>
                </div>
                <div className="flex gap-2 col-span-2">
                  <span className="font-semibold">Албан тушаал:</span>
                  <span className="">{employee.position_name}</span>
                </div>
                <div className="flex gap-2 col-span-2">
                  <span className="font-semibold">Ээлжийн нэр:</span>
                  <span>
                    {shiftInfo?.currentGroupName ||
                      shiftInfo?.shiftType ||
                      "Мэдээлэл алга"}
                  </span>
                </div>
                <div className="flex gap-2 col-span-2">
                  <span className="font-semibold">Ажлын цаг:</span>
                  <span>
                    {shiftInfo
                      ? `${formatShiftTime(shiftInfo.startAt)} - ${formatShiftTime(
                          shiftInfo.endAt,
                        )}`
                      : "Мэдээлэл алга"}
                  </span>
                </div>
                <div className="flex gap-2 col-span-2">
                  <span className="font-semibold">Оршин суугаа хаяг:</span>
                  <span className="">
                    {employee.address || "Мэдээлэл алга"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold">Имэйл:</span>
                  <span className="">{employee.email || "Мэдээлэл алга"}</span>
                </div>
              </div>
              {employee.job_position_id && (
                <div
                  onClick={() =>
                    handleNavigateJobDesc(employee.job_position_id ?? null)
                  }
                  className="text-blue-500 text-sm cursor-pointer hover:underline flex items-center justify-end gap-1 opacity-90 italic">
                  <LinkIcon className="h-4 w-4" />
                  Албан тушаалын тодорхойлолт
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="dining_halls"
              className="p-4 border rounded-b-md mt-2">
              <UserMealConfig
                userId={employee.id}
                canEdit={permissions.canEditDine}
              />
            </TabsContent>

            {/* <TabsContent
              value="attendance"
              className="p-4 border rounded-b-md mt-2">
              <p className="text-muted-foreground text-sm">
                Ирцийн бүртгэл энд харагдана...
              </p>
            </TabsContent> */}

            {/* <TabsContent
              value="actions"
              className="p-4 border rounded-b-md mt-2 space-y-2">
              <Button variant="outline" className="w-full justify-start">
                Нууц үг шинэчлэх
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Эрх засах
              </Button>
              <Button variant="destructive" className="w-full justify-start">
                Ажлаас чөлөөлөх
              </Button>
            </TabsContent> */}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
