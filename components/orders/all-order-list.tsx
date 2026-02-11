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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type TabType = "not_approved" | "approved";

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
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("not_approved");

  useEffect(() => {
    fetchOrders();
    fetchSummaries();
  }, [page, debouncedSearch, activeTab]);

  async function fetchOrders() {
    setLoading(true);
    try {
      let query = supabase
        .from("orders")
        .select(
          `
          id,
          title,
          status,
          management_status,
          created_at,
          profile:created_profile(
            name,
            department_name
          )
        `,
          { count: "exact" },
        )
        .ilike("title", `%${debouncedSearch}%`);

      // Tab-ын дагуу шүүх
      if (activeTab === "approved") {
        query = query.in("status", ["approved", "changes_requested"]);
      } else {
        query = query.not("status", "in", "('approved','changes_requested')");
      }

      const { data, count, error } = await query
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        management_status: row.management_status,
        created_at: row.created_at,
        profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
      }));

      setOrders(normalized);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / PAGE_SIZE));
    } catch (err: any) {
      console.error(err);
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
    // Баталгаажсан эсвэл өөрчлөгдөж батлагдсан бол imp рүү
    if (order.status === "approved" || order.status === "changes_requested") {
      return `/orders/${order.id}/imp`;
    }
    // Бусад тохиолдолд ерөнхий хуудас руу
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
    <div className="bg-white dark:bg-gray-900 p-6 rounded-lg  space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Захиалгын нэгдсэн систем</h1>
        <input
          className="border px-4 py-2 rounded-md min-w-[400px]"
          placeholder="Захиалгын гарчиг хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Нийт тооны картууд */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="flex flex-col items-center justify-center gap-1 h-full p-4">
            <div className="text-sm text-muted-foreground">Нийт захиалга</div>
            <div className="text-3xl font-bold">{totalOrdersCount()}</div>
          </CardContent>
        </Card>

        {/* Үндсэн статусын картууд (management_status-гүй зөвхөн) */}
        {statusSummary.map((s) => (
          <Card
            key={`status-${s.status}`}
            className="bg-gray-50 dark:bg-gray-800/50">
            <CardContent className="flex flex-col items-center justify-center gap-1 h-full p-4">
              <div className="text-sm text-muted-foreground">
                {STATUS_LABELS[s.status] ?? s.status}
              </div>
              <div className="text-2xl font-bold">{s.total}</div>
            </CardContent>
          </Card>
        ))}

        {/* Management статусын картууд */}
        {managementStatusSummary.map((s) => (
          <Card
            key={`mgmt-${s.status}`}
            className="bg-purple-50 dark:bg-purple-900/20">
            <CardContent className="flex flex-col items-center justify-center gap-1 h-full p-4">
              <div className="text-sm text-muted-foreground">
                {MANAGEMENT_STATUS_LABELS[s.status] ?? s.status}
              </div>
              <div className="text-2xl font-bold">{s.total}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as TabType);
          setPage(1);
        }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="not_approved">
            Батлагдаагүй захиалгууд
          </TabsTrigger>
          <TabsTrigger value="approved">Батлагдсан захиалгууд</TabsTrigger>
        </TabsList>

        {/* Батлагдаагүй захиалгууд */}
        <TabsContent value="not_approved" className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold text-center">
                    Гарчиг
                  </TableHead>
                  <TableHead className="font-bold text-center">
                    Үүсгэгч
                  </TableHead>
                  <TableHead className="font-bold text-center">
                    Статус
                  </TableHead>
                  <TableHead className="font-bold text-center">Огноо</TableHead>
                  <TableHead className="font-bold text-center">
                    Үйлдэл
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Ачаалж байна...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-gray-500">
                      Захиалга олдсонгүй
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="max-w-[300px] truncate">
                        {order.title}
                      </TableCell>
                      <TableCell>
                        <div>{order.profile?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.profile?.department_name}
                        </div>
                      </TableCell>
                      <TableCell>{renderStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        {new Date(order.created_at).toLocaleDateString("mn-MN")}
                      </TableCell>
                      <TableCell>
                        <Link href={getDetailLink(order)}>
                          <Button size="sm" variant="outline">
                            Дэлгэрэнгүй
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Батлагдсан захиалгууд */}
        <TabsContent value="approved" className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Гарчиг</TableHead>
                  <TableHead>Үүсгэгч</TableHead>
                  <TableHead>Баталгааны статус</TableHead>
                  <TableHead>Удирдлагын статус</TableHead>
                  <TableHead>Огноо</TableHead>
                  <TableHead>Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Ачаалж байна...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-gray-500">
                      Баталгаажсан захиалга олдсонгүй
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="max-w-[300px] truncate">
                        {order.title}
                      </TableCell>
                      <TableCell>
                        <div>{order.profile?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.profile?.department_name}
                        </div>
                      </TableCell>
                      <TableCell>{renderStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        {order.management_status ? (
                          renderManagementStatusBadge(order.management_status)
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Тохируулаагүй
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(order.created_at).toLocaleDateString("mn-MN")}
                      </TableCell>
                      <TableCell>
                        <Link href={getDetailLink(order)}>
                          <Button size="sm" variant="outline">
                            Дэлгэрэнгүй
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

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
