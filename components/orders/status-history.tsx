"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { mn } from "date-fns/locale";

interface StatusHistoryItem {
  id: string;
  old_status: string;
  new_status: string;
  reason?: string;
  created_at: string;
  profile?: {
    name?: string;
  };
}

interface StatusHistoryProps {
  orderId: string;
}

export function StatusHistory({ orderId }: StatusHistoryProps) {
  const supabase = createClient();
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatusHistory();
  }, [orderId]);

  async function fetchStatusHistory() {
    try {
      const { data, error } = await supabase
        .from("order_status_history")
        .select(
          `
          id,
          old_status,
          new_status,
          reason,
          created_at,
          profile:changed_by(
            name
          )
        `
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((row: any) => ({
        ...row,
        profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
      }));

      setHistory(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const map = {
      pending: { label: "Шинэ", variant: "secondary" as const },
      in_progress: { label: "Процесс-д", variant: "outline" as const },
      approved: { label: "Баталгаажсан", variant: "default" as const },
      changes_requested: {
        label: "Өөрчлөгдөж батлагдсан",
        variant: "outline" as const,
      },
      rejected: { label: "Татгалзсан", variant: "destructive" as const },
    };

    const s = map[status as keyof typeof map] || {
      label: status,
      variant: "outline" as const,
    };

    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  if (loading) {
    return <div className="text-center py-4">Түүх ачаалж байна...</div>;
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Статус өөрчлөлтийн түүх</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            Статус өөрчлөлтийн түүх байхгүй
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Статус өөрчлөлтийн түүх</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Хуучин статус</TableHead>
              <TableHead>Шинэ статус</TableHead>
              <TableHead>Шалтгаан</TableHead>
              <TableHead>Хэн</TableHead>
              <TableHead>Хэзээ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{getStatusBadge(item.old_status)}</TableCell>
                <TableCell>{getStatusBadge(item.new_status)}</TableCell>
                <TableCell className="max-w-[200px]">
                  {item.reason || "-"}
                </TableCell>
                <TableCell>{item.profile?.name || "Систем"}</TableCell>
                <TableCell>
                  {format(new Date(item.created_at), "yyyy-MM-dd HH:mm", {
                    locale: mn,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
