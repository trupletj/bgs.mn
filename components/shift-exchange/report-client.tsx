"use client";

import { useState, useTransition } from "react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getReportRows, type ReportRow } from "@/actions/shift-exchange";
import type { ShiftExchangeWithStats } from "@/types/shift-exchange";

export function ReportClient({
  exchanges,
}: {
  exchanges: ShiftExchangeWithStats[];
}) {
  const [selected, setSelected] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [pending, startTransition] = useTransition();

  const exchange = exchanges.find((e) => String(e.id) === selected);

  const load = (id: string) => {
    setSelected(id);
    startTransition(async () => {
      setRows(await getReportRows(Number(id)));
    });
  };

  const exportExcel = () => {
    if (!rows.length) return toast.error("Дата алга");
    const byBus = new Map<string, ReportRow[]>();
    for (const r of rows) {
      const arr = byBus.get(r.busName) ?? [];
      arr.push(r);
      byBus.set(r.busName, arr);
    }
    const wb = XLSX.utils.book_new();
    for (const [busName, busRows] of byBus) {
      const sheet = busRows.map((r, i) => ({
        "#": i + 1,
        Нэр: r.passengerName,
        Байгууллага: r.organizationName ?? "",
        Алба: r.alba ?? "",
        Чиглэл: r.directionName ?? "",
        Утас: r.phone ?? "",
        Баталгаажсан: r.confirmed ? "Тийм" : "Үгүй",
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(sheet),
        busName.slice(0, 31) || "Автобус",
      );
    }
    const file = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([file], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `shift-exchange-${exchange?.exchangeDate ?? selected}.xlsx`,
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Ээлж солилцоо
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Тайлан
        </h1>
      </div>

      <Card className="gap-3 px-4 py-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label>Ээлж сонгох</Label>
          <Select value={selected} onValueChange={load}>
            <SelectTrigger>
              <SelectValue placeholder="Ээлж сонгох..." />
            </SelectTrigger>
            <SelectContent>
              {exchanges.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name} ({e.exchangeDate})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={exportExcel} disabled={!rows.length || pending}>
          <Download className="h-4 w-4" />
          Excel татах
        </Button>
      </Card>

      {selected && (
        <Card className="overflow-hidden p-0">
          {pending ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Уншиж байна...
            </p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Зорчигч алга</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Автобус</TableHead>
                  <TableHead>Нэр</TableHead>
                  <TableHead className="w-44">Байгууллага</TableHead>
                  <TableHead className="w-36">Алба</TableHead>
                  <TableHead className="w-28">Чиглэл</TableHead>
                  <TableHead className="w-28">Баталгаажсан</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{r.busName}</TableCell>
                    <TableCell className="font-medium">
                      {r.passengerName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.organizationName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.alba ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.directionName ?? "—"}
                    </TableCell>
                    <TableCell>
                      {r.confirmed ? (
                        <span className="text-emerald-600">✓</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
