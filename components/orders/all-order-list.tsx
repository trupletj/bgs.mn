"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounce } from "use-debounce";
import Link from "next/link";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Inbox,
  ArrowUpRight,
  User,
  Building2,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  title: string;
  status: string;
  created_at: string;
  profile?: { name?: string; department_name?: string } | null;
}

interface StatusCount {
  status: string;
  total: number;
}

type OrderRow = Omit<Order, "profile"> & {
  profile?: Order["profile"] | Order["profile"][];
};

interface OrderSummaryRow {
  status?: string | null;
}

const PAGE_SIZE = 15;

// ─── Status config ───────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  pending:           { label: "Шинэ",              className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress:       { label: "Процесс-д",          className: "bg-amber-50 text-amber-700 border-amber-200" },
  created_step:      { label: "Хянагдаж байна",    className: "bg-orange-50 text-orange-700 border-orange-200" },
  approved:          { label: "Батлагдсан",         className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  changes_requested: { label: "Өөрчлөлттэй батлагдсан", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected:          { label: "Татгалзсан",         className: "bg-red-50 text-red-700 border-red-200" },
};

const ORDER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label])
);

function StatusBadge({ status }: { status: string }) {
  const cfg = ORDER_STATUS[status];
  const className = cfg?.className ?? "bg-gray-100 text-gray-600 border-gray-200";
  const label = cfg?.label ?? status;
  return (
    <Badge variant="outline" className={cn("h-5 px-2 text-[11px] font-medium", className)}>
      {label}
    </Badge>
  );
}

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AllOrderList() {
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStatusCounts, setOrderStatusCounts] = useState<StatusCount[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("all");

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Fetch orders ────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("orders")
        .select(
          "id, title, status, created_at, profile:created_profile(name, department_name)",
          { count: "exact" }
        )
        .ilike("title", `%${debouncedSearch}%`);

      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }

      const { data, count, error } = await query
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOrders(
        ((data || []) as OrderRow[]).map((row) => ({
          ...row,
          profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
        }))
      );
      setTotalCount(count ?? 0);
    } catch {
      toast.error("Захиалгын жагсаалт уншиж чадсангүй");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedStatus, supabase]);

  // ── Fetch summaries ──────────────────────────────────────────────────────────
  const fetchSummaries = useCallback(async () => {
    const { data } = await supabase.from("orders").select("status");
    if (!data) return;

    const orderMap: Record<string, number> = {};

    (data as OrderSummaryRow[]).forEach((row) => {
      if (row.status) {
        orderMap[row.status] = (orderMap[row.status] || 0) + 1;
      }
    });

    setOrderStatusCounts(Object.entries(orderMap).map(([status, total]) => ({ status, total })));
  }, [supabase]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { fetchSummaries(); }, [fetchSummaries]);

  // Reset page when filter/search changes
  useEffect(() => { setPage(1); }, [debouncedSearch, selectedStatus]);

  const totalAll = orderStatusCounts.reduce((s, c) => s + c.total, 0);

  const activeFilterLabel =
    selectedStatus === "all"
      ? null
      : ORDER_STATUS_LABELS[selectedStatus] || selectedStatus;

  const getDetailHref = (order: Order) =>
    order.status === "approved" || order.status === "changes_requested"
      ? `/orders/${order.id}/imp`
      : `/orders/${order.id}`;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 ">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Захиалгын нэгдсэн мэдээлэл</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Системийн бүх захиалгыг харах, удирдах
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Захиалгын нэрээр хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-card pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Status filter bar — sticky below site header ─────────────── */}
      <div className="sticky top-12 z-[9] -mx-4 border-b border-border/50 bg-background/95 px-4 py-2.5 backdrop-blur-sm lg:-mx-6 lg:px-6">

        {/* Mobile: select dropdown */}
        <div className="sm:hidden">
          <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-full bg-card text-sm">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Шүүлтүүр сонгох" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="flex items-center gap-2">
                  Бүгд
                  <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {totalAll}
                  </span>
                </span>
              </SelectItem>
              {orderStatusCounts.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Захиалгын статус
                  </div>
                  {orderStatusCounts.map((s) => (
                    <SelectItem key={`o-${s.status}`} value={s.status}>
                      <span className="flex items-center gap-2">
                        {ORDER_STATUS_LABELS[s.status] ?? s.status}
                        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                          {s.total}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop: pill row with right fade */}
        <div className="relative hidden sm:block">
          <div className="flex gap-2 overflow-x-auto p-0.5 [&::-webkit-scrollbar]:hidden">
            <FilterPill
              label="Бүгд"
              count={totalAll}
              active={selectedStatus === "all"}
              onClick={() => setSelectedStatus("all")}
              colorClass="bg-primary/10 text-primary border-primary/20"
              activeClass="bg-primary text-white border-primary"
            />
            {orderStatusCounts.map((s) => (
              <FilterPill
                key={`o-${s.status}`}
                label={ORDER_STATUS_LABELS[s.status] ?? s.status}
                count={s.total}
                active={selectedStatus === s.status}
                onClick={() => setSelectedStatus(s.status)}
                colorClass={cn("border", ORDER_STATUS[s.status]?.className ?? "bg-gray-100 text-gray-600 border-gray-200")}
                activeClass="ring-2 ring-current"
              />
            ))}
          </div>
          {/* Right fade mask */}
          <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-background/95 to-transparent" />
        </div>
      </div>

      {/* ── Active filter indicator ─────────────────────────────────── */}
      {activeFilterLabel && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">Шүүлтүүр:</span>
          <span className="font-medium text-foreground">{activeFilterLabel}</span>
          <button
            onClick={() => { setSelectedStatus("all"); setPage(1); }}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            <X className="h-3 w-3" />
            <span className="hidden sm:inline">Цуцлах</span>
          </button>
        </div>
      )}

      {/* ── Table (desktop) ─────────────────────────────────────────── */}
      <div className="hidden rounded-xl border border-border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-5 font-semibold">Захиалга</TableHead>
              <TableHead className="font-semibold">Үүсгэгч</TableHead>
              <TableHead className="font-semibold">Баталгаажуулалт</TableHead>
              <TableHead className="font-semibold">Огноо</TableHead>
              <TableHead className="pr-5 text-right font-semibold">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-5"><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="pr-5"><Skeleton className="ml-auto h-7 w-14" /></TableCell>
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                      <Inbox className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                    <p className="font-medium text-foreground">Захиалга олдсонгүй</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {search ? "Хайлтын утгаа өөрчилж дахин оролдоно уу" : "Энэ шүүлтүүрт захиалга байхгүй байна"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="group transition-colors hover:bg-muted/30"
                >
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                        <Package className="h-4 w-4" />
                      </div>
                      <span className="max-w-[220px] truncate text-sm font-medium text-foreground">
                        {order.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.profile?.name ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {order.profile.name}
                        </span>
                        {order.profile.department_name && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {order.profile.department_name}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(order.created_at)}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 px-3 text-xs font-medium"
                    >
                      <Link href={getDetailHref(order)}>
                        Харах
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Card list (mobile) ───────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <Skeleton className="mb-2 h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <Inbox className="mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium">Захиалга олдсонгүй</p>
          </div>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={getDetailHref(order)}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <Package className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {order.title}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={order.status} />
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(order.created_at)}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:text-primary/50" />
            </Link>
          ))
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalCount)}
            <span className="text-muted-foreground/60"> / {totalCount} захиалга</span>
          </p>

          <div className="flex items-center gap-1">
            <PaginationButton
              icon={ChevronsLeft}
              label="Эхний"
              disabled={page === 1}
              onClick={() => setPage(1)}
            />
            <PaginationButton
              icon={ChevronLeft}
              label="Өмнөх"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            />
            <span className="px-3 text-sm font-medium tabular-nums">
              {page}
              <span className="text-muted-foreground"> / {totalPages}</span>
            </span>
            <PaginationButton
              icon={ChevronRight}
              label="Дараагийн"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            />
            <PaginationButton
              icon={ChevronsRight}
              label="Сүүлийн"
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FilterPill({
  label,
  count,
  active,
  onClick,
  colorClass,
  activeClass,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  colorClass: string;
  activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
        colorClass,
        active && activeClass
      )}
    >
      <span>{label}</span>
      <span className={cn(
        "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
        active ? "bg-white/20" : "bg-black/8"
      )}>
        {count}
      </span>
    </button>
  );
}

function PaginationButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-8 w-8"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}
