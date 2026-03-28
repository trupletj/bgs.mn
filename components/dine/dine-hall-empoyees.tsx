"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Phone } from "lucide-react";

interface Props {
  initialEmployees: any[];
  hallName: string;
  hallId: string;
}

export default function DiningHallEmployees({
  initialEmployees,
  hallName,
  hallId,
}: Props) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredResults = useMemo(() => {
    return initialEmployees.filter((emp) => {
      const user = emp.users;
      const search = searchTerm.toLowerCase();
      const fullName = `${user?.last_name} ${user?.first_name}`.toLowerCase();
      const phone = user?.phone || "";
      const btegId = emp.bteg_id?.toLowerCase() || "";

      return (
        fullName.includes(search) ||
        phone.includes(search) ||
        btegId.includes(search)
      );
    });
  }, [initialEmployees, searchTerm]);

  const displayEmployees = useMemo(() => {
    return filteredResults.slice(0, 50);
  }, [filteredResults]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{hallName || "Гал тогоо"}</h1>
          <p className="text-muted-foreground">Бүртгэлтэй ажилчдын жагсаалт</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Овог, нэр, утас эсвэл кодоор хайх..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Овог Нэр</TableHead>
              <TableHead>Утас</TableHead>
              <TableHead>Хэлтэс / Албан тушаал</TableHead>
              <TableHead className="text-right">Хуваарь</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayEmployees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-40 text-center text-muted-foreground">
                  Ийм ажилтан олдсонгүй.
                </TableCell>
              </TableRow>
            ) : (
              displayEmployees.map((emp) => (
                <TableRow
                  key={emp.id}
                  className="hover:bg-slate-50/50 cursor-pointer">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400 uppercase">
                        {emp.users?.last_name}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {emp.users?.first_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Phone className="h-3 w-3 text-slate-400" />
                      {emp.users?.phone || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-slate-700">
                        {emp.users?.department_name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {emp.users?.position_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end flex-wrap gap-1">
                      {[
                        {
                          key: "morning_meal_location",
                          label: "Өглөө хоол",
                          color: "bg-cyan-50 text-cyan-600 border-cyan-100",
                        },
                        {
                          key: "breakfast_location",
                          label: "Өглөө цай",
                          color: "bg-blue-50 text-blue-600 border-blue-100",
                        },
                        {
                          key: "lunch_location",
                          label: "Өдөр",
                          color:
                            "bg-emerald-50 text-emerald-600 border-emerald-100",
                        },
                        {
                          key: "dinner_location",
                          label: "Орой",
                          color:
                            "bg-orange-50 text-orange-600 border-orange-100",
                        },
                        {
                          key: "night_meal_location",
                          label: "Шөнө",
                          color:
                            "bg-indigo-50 text-indigo-600 border-indigo-100",
                        },
                        {
                          key: "extend_morning_meal_location",
                          label: "Сунасан өглөө",
                          color:
                            "bg-purple-50 text-purple-600 border-purple-100",
                        },
                        {
                          key: "extend_lunch_location",
                          label: "Сунгасан өдөр",
                          color: "bg-rose-50 text-rose-600 border-rose-100",
                        },
                      ].map(
                        (meal) =>
                          emp[meal.key] === Number(hallId) && (
                            <span
                              key={meal.key}
                              className={`${meal.color} border px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap`}>
                              {meal.label}
                            </span>
                          ),
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center text-sm text-muted-foreground px-2">
        <div className="flex gap-2">
          <span>
            Илэрц: <b>{displayEmployees.length}</b> / {filteredResults.length}
          </span>
          {filteredResults.length > 50 && (
            <span className="text-orange-500 text-[12px]">
              (Эхний 50-ийг харуулж байна)
            </span>
          )}
        </div>
        <span>{hallName}</span>
      </div>
    </div>
  );
}
