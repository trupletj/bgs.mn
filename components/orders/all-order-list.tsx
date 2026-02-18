"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "use-debounce";
import Link from "next/link";
import { toast } from "sonner";

interface Order {
  id: string;
  title: string;
  status: string;
  management_status?: string;
  created_at: string;
  profile?: {
    name?: string;
    department_name?: string;
  };
}

interface StatusSummary {
  status: string;
  total: number;
}

interface ManagementStatusSummary {
  status: string;
  total: number;
}

const PAGE_SIZE = 15;

const STATUS_LABELS: Record<string, string> = {
  pending: "Шинэ захиалга",
  in_progress: "Процесс-д",
  created_step: "Захиалга үүссэн",
  approved: "Баталгаажсан",
  changes_requested: "Өөрчлөгдөж батлагдсан",
  rejected: "Татгалзсан",
};

const MANAGEMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Захиалга хийгдэж байна",
  processing: "Боловсруулж байна",
  completed: "Дууссан",
  cancelled: "Цуцлагдсан",
  on_hold: "Түр зогссон",
};

const STATUS_BADGE: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Шинэ", variant: "secondary" },
  in_progress: { label: "Процесс-д", variant: "outline" },
  created_step: { label: "Захиалга үүссэн", variant: "outline" },
  approved: { label: "Баталгаажсан", variant: "default" },
  changes_requested: {
    label: "Өөрчлөгдөж батлагдсан",
    variant: "outline",
  },
  rejected: { label: "Татгалзсан", variant: "destructive" },
};

const MANAGEMENT_STATUS_BADGE: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Хүлээгдэж байна", variant: "outline" },
  processing: { label: "Боловсруулж байна", variant: "secondary" },
  completed: { label: "Дууссан", variant: "default" },
  cancelled: { label: "Цуцлагдсан", variant: "destructive" },
  on_hold: { label: "Түр зогссон", variant: "outline" },
};

export default function AllOrderList() {
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary[]>([]);
  const [managementStatusSummary, setManagementStatusSummary] = useState<
    ManagementStatusSummary[]
  >([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  useEffect(() => {
    fetchOrders();
    fetchSummaries();
  }, [page, debouncedSearch, selectedStatus]);

  async function fetchOrders() {
    setLoading(true);
    try {
      let query = supabase
        .from("orders")
        .select(
          `
          id, title, status, management_status, created_at,
          profile:created_profile(name, department_name)
        `,
          { count: "exact" },
        )
        .ilike("title", `%${debouncedSearch}%`);

      // КАРТААР ШҮҮХ ЛОГИК
      if (selectedStatus !== "all") {
        // Хэрэв сонгосон статус нь management_status-д хамааралтай бол
        if (MANAGEMENT_STATUS_LABELS[selectedStatus]) {
          query = query.eq("management_status", selectedStatus);
        } else {
          // Үгүй бол үндсэн status-аар шүүнэ
          query = query.eq("status", selectedStatus);
        }
      }

      const { data, count, error } = await query
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((row: any) => ({
        ...row,
        profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
      }));

      setOrders(normalized);
      setTotalPages(Math.ceil((count || 0) / PAGE_SIZE));
    } catch (err: any) {
      toast.error("Захиалгын жагсаалт уншиж чадсангүй");
    } finally {
      setLoading(false);
    }
  }
  async function fetchSummaries() {
    try {
      // Үндсэн статусын summary
      const { data: statusData, error: statusError } = await supabase
        .from("orders")
        .select("status, management_status");

      if (!statusError && statusData) {
        const statusMap: Record<string, number> = {};
        statusData.forEach((row) => {
          if (!row.status) return;
          // management_status-той бол status-г тоолохгүй
          if (row.management_status) return;
          statusMap[row.status] = (statusMap[row.status] || 0) + 1;
        });

        const result: StatusSummary[] = Object.entries(statusMap).map(
          ([status, total]) => ({
            status,
            total,
          }),
        );
        console.log("all status", result);
        setStatusSummary(result);
      }

      // Management status summary
      const { data: mgmtData, error: mgmtError } = await supabase
        .from("orders")
        .select("management_status")
        .not("management_status", "is", null);

      if (!mgmtError && mgmtData) {
        const mgmtMap: Record<string, number> = {};
        mgmtData.forEach((row) => {
          if (!row.management_status) return;
          mgmtMap[row.management_status] =
            (mgmtMap[row.management_status] || 0) + 1;
        });

        const result: ManagementStatusSummary[] = Object.entries(mgmtMap).map(
          ([status, total]) => ({
            status,
            total,
          }),
        );
        setManagementStatusSummary(result);
        console.log("management status", result);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const renderStatusBadge = (status: string) => {
    const s = STATUS_BADGE[status] || {
      label: status,
      variant: "outline",
    };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const renderManagementStatusBadge = (status: string) => {
    const s = MANAGEMENT_STATUS_BADGE[status] || {
      label: status,
      variant: "outline",
    };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const getDetailLink = (order: Order) => {
    if (order.status === "approved" || order.status === "changes_requested") {
      return `/orders/${order.id}/imp`;
    }
    return `/orders/${order.id}`;
  };

  const totalOrdersCount = () => {
    const statusTotal = statusSummary.reduce((sum, s) => sum + s.total, 0);
    const mgmtTotal = managementStatusSummary.reduce(
      (sum, s) => sum + s.total,
      0,
    );
    return statusTotal + mgmtTotal;
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">Захиалгын нэгдсэн систем</h1>
        <div className="relative w-full md:w-[400px]">
          <input
            className="w-full border px-4 py-2 rounded-md"
            placeholder="Захиалгын гарчиг хайх..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Статус картууд - Interactive */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card
          onClick={() => setSelectedStatus("all")}
          className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${selectedStatus === "all" ? "ring-2 ring-blue-600 bg-blue-50/50" : "bg-blue-50/30"}`}>
          <CardContent className="flex flex-col items-center justify-center p-4">
            <div className="text-xs text-muted-foreground uppercase font-semibold">
              Нийт
            </div>
            <div className="text-3xl font-bold">{totalOrdersCount()}</div>
          </CardContent>
        </Card>

        {statusSummary.map((s) => (
          <Card
            key={`status-${s.status}`}
            onClick={() => setSelectedStatus(s.status)}
            className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${selectedStatus === s.status ? "ring-2 ring-gray-800 bg-gray-100" : "bg-gray-50/50"}`}>
            <CardContent className="flex flex-col items-center justify-center p-4">
              <div className="text-xs text-muted-foreground text-center line-clamp-1">
                {STATUS_LABELS[s.status] ?? s.status}
              </div>
              <div className="text-2xl font-bold">{s.total}</div>
            </CardContent>
          </Card>
        ))}

        {managementStatusSummary.map((s) => (
          <Card
            key={`mgmt-${s.status}`}
            onClick={() => setSelectedStatus(s.status)}
            className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${selectedStatus === s.status ? "ring-2 ring-purple-600 bg-purple-50" : "bg-purple-50/50"}`}>
            <CardContent className="flex flex-col items-center justify-center p-4">
              <div className="text-xs text-muted-foreground text-center line-clamp-1">
                {MANAGEMENT_STATUS_LABELS[s.status] ?? s.status}
              </div>
              <div className="text-2xl font-bold">{s.total}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Шүүлтүүрийн мэдээлэл */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {selectedStatus === "all"
            ? "Бүх захиалга"
            : `Шүүлтүүр: ${STATUS_LABELS[selectedStatus] || MANAGEMENT_STATUS_LABELS[selectedStatus] || selectedStatus}`}
        </div>
        {selectedStatus !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedStatus("all")}>
            Шүүлтүүр цуцлах
          </Button>
        )}
      </div>

      {/* Хүснэгт */}
      <div className="border rounded-md">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Гарчиг</TableHead>
              <TableHead>Үүсгэгч</TableHead>
              <TableHead>Баталгаажуулалт</TableHead>
              <TableHead>Удирдлагын статус</TableHead>
              <TableHead>Огноо</TableHead>
              <TableHead className="text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Ачаалж байна...
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground">
                  Захиалга олдсонгүй
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium max-w-[250px] truncate">
                    {order.title}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{order.profile?.name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      {order.profile?.department_name}
                    </div>
                  </TableCell>
                  <TableCell>{renderStatusBadge(order.status)}</TableCell>
                  <TableCell>
                    {order.management_status ? (
                      renderManagementStatusBadge(order.management_status)
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(order.created_at).toLocaleDateString("mn-MN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={getDetailLink(order)}>
                      <Button size="sm" variant="outline">
                        Үзэх
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {page} / {totalPages} хуудас
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(1)}>
            Эхний
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}>
            Өмнөх
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}>
            Дараагийн
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage(totalPages)}>
            Сүүлийн
          </Button>
        </div>
      </div>
    </div>
  );
}
