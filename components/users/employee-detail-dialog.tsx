"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Phone,
  Briefcase,
  Building2,
  User,
  LinkIcon,
} from "lucide-react";
import { Card } from "../ui/card";
import { MdWorkOutline } from "react-icons/md";
import { RiMoonClearFill } from "react-icons/ri";
import { FaHelmetSafety } from "react-icons/fa6";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { UserMealConfig } from "../dine/user-meal-config";
import { RiProfileLine } from "react-icons/ri";
import { DialogDescription } from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";

interface EmployeeDetailDialogProps {
  employee: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

  useEffect(() => {
    if (!open) {
      setActiveTab("");
    }
  }, [open]);

  if (!employee) return null;
  const supabase = createClient();

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

      const url = `/dashboard/job-descriptions/${jobDesc.id}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[60vw] h-[80vh] flex flex-col overflow-y-auto [scrollbar-gutter:stable]">
        <div className="my-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="mb-4 flex items-center gap-2 text-2xl">
              <User className="h-6 w-6" />
              Ажилтны мэдээлэл
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">
            Ажилтны талаарх мэдээллүүд агуулагдана
          </DialogDescription>
          <Card className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
            <div className="space-y-2">
              <label className="text- text-muted-foreground uppercase font-bold">
                Овог нэр
              </label>
              <p className="text-lg font-semibold">
                {employee.last_name} {employee.first_name}
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>{employee.department_name || "Хэлтэс тодорхойгүй"}</span>
              </div>
              <div className="flex items-center gap-2 ">
                <Briefcase className="h-4 w-4" />
                <span>
                  {employee.position_name || "Албан тушаал тодорхойгүй"}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-sm border-l md:pl-6">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span>{employee.phone || "Мэдээлэл алга"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="truncate">
                  {employee.location || "Мэдээлэл алга"}
                </span>
              </div>
            </div>

            <div
              className="inline-flex items-center gap-2 px-3 py-1 
                    rounded-full bg-green-200 text-green-700 
                    text-xs font-medium">
              <MdWorkOutline className="w-4 h-4 text-green-600" />
              Ажиллаж байгаа
            </div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1
                    rounded-full bg-blue-600 text-white 
                    text-xs font-medium">
              <RiMoonClearFill className="w-6 h-6" />
              Шөнийн ээлж
            </div>

            <div className="inline-flex gap-2 text-xs items-center  bg-amber-300 rounded-full py-1 font-medium px-3">
              <FaHelmetSafety className="w-6 h-6" />
              BTEG-B2
            </div>
          </Card>
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
                  <span className="font-semibold ">Алба, Хэлтэс:</span>
                  <span className="">
                    {getHeltesAndDepartment(
                      employee.department_name,
                      employee.heltes_name,
                    )}
                  </span>
                </div>
                <div className="flex gap-2 col-span-2">
                  <span className="font-semibold">Албан тушаал:</span>
                  <span className="">{employee.position_name}</span>
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
                    handleNavigateJobDesc(employee.job_position_id)
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
