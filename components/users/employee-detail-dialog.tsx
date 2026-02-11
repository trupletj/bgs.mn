"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Briefcase, Building2, User, Sun } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { MdWorkOutline } from "react-icons/md";
import { RiMoonClearFill } from "react-icons/ri";
import { FaHelmetSafety } from "react-icons/fa6";

interface EmployeeDetailDialogProps {
  employee: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeDetailDialog({
  employee,
  open,
  onOpenChange,
}: EmployeeDetailDialogProps) {
  if (!employee) return null;
  console.log("employeee:", employee);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[50vw] h-[80vh] overflow-y-auto flex flex-col">
        <div className="my-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="mb-4 flex items-center gap-2 text-2xl">
              <User className="h-6 w-6" />
              Ажилтны мэдээлэл
            </DialogTitle>
          </DialogHeader>

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

        {/* 2-р мөр: Табууд (Tabs Section) */}
        <div className="flex-1 ">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Ерөнхий</TabsTrigger>
              <TabsTrigger value="orders">Захиалгууд</TabsTrigger>
              <TabsTrigger value="attendance">Ирц / Түүх</TabsTrigger>
              <TabsTrigger value="actions">Үйлдэл</TabsTrigger>
            </TabsList>

            <TabsContent
              value="overview"
              className="p-4 border rounded-b-md mt-2 space-y-4">
              {/* Энд ажилтны бусад хувийн мэдээллүүдийг харуулж болно */}
              <h3 className="font-medium">Дэлгэрэнгүй мэдээлэл</h3>
              <div className="grid md:grid-cols-3 grid-cols-2 text-left gap-y-4 gap-x-6 text-sm">
                {/* Овог */}
                <div className="flex gap-2">
                  <span className="font-semibold">Овог:</span>
                  <span className="">{employee.last_name}</span>
                </div>

                {/* Нэр */}
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                    Нэр
                  </span>
                  <span className="font-semibold text-foreground">
                    {employee.first_name}
                  </span>
                </div>

                {/* Регистрийн дугаар */}
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                    Регистрийн дугаар
                  </span>
                  <span className="font-semibold text-foreground uppercase">
                    {employee.register_number}
                  </span>
                </div>

                {/* Алба / Хэлтэс */}
                <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
                  <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                    Алба / Хэлтэс
                  </span>
                  <span className="font-semibold text-foreground">
                    {employee.heltes_name}
                  </span>
                </div>

                {/* Оршин суугаа хаяг */}
                <div className="flex flex-col gap-1 col-span-2">
                  <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                    Оршин суугаа хаяг
                  </span>
                  <span className="font-semibold text-foreground leading-relaxed">
                    {employee.address}
                  </span>
                </div>

                {/* Төлөв */}
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                    Төлөв
                  </span>
                  <div>
                    {employee.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Идэвхтэй
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Идэвхгүй
                      </span>
                    )}
                  </div>
                </div>

                {/* Имэйл (JSON-д байгаа тул нэмлээ) */}
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
                    Имэйл хаяг
                  </span>
                  <span className="font-semibold text-foreground">
                    {employee.email}
                  </span>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="orders"
              className="p-4 border rounded-b-md mt-2">
              <p className="text-muted-foreground text-sm">
                Захиалгын жагсаалт энд харагдана...
              </p>
              {/* <OrderHistoryTable employeeId={employee.id} /> гэх мэт өөр компонент дуудаж болно */}
            </TabsContent>

            <TabsContent
              value="attendance"
              className="p-4 border rounded-b-md mt-2">
              <p className="text-muted-foreground text-sm">
                Ирцийн бүртгэл энд харагдана...
              </p>
            </TabsContent>

            <TabsContent
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
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
