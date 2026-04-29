"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef, flexRender, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, useReactTable, type SortingState,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEVICE_TYPE_CONFIG, type DeviceType, type OrgStructure } from "@/types/device";
import { DeviceRequestActions } from "@/components/devices/device-request-actions";
import { REQUEST_TYPE_CONFIG, PRIORITY_CONFIG } from "@/components/devices/request-shared";
import type { DeviceRequestType, DeviceRequestPriority, DeviceRequestStatus } from "@/actions/devices";
import { ArrowUpDown, Pencil, ChevronLeft, ChevronRight, Search, X, Link2 } from "lucide-react";

const ALL = "__all__";

const STATUS_CONFIG: Record<DeviceRequestStatus, { label: string; className: string }> = {
  pending:  { label: "Хүлээгдэж буй", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Зөвшөөрөгдсөн", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Татгалзсан",     className: "bg-red-50 text-red-700 border-red-200" },
};

function formatDate(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

type Request = any;

interface Props {
  data: Request[];
  orgStructure: OrgStructure;
}

const PILL = "rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer";
const PILL_ON = "bg-foreground text-background border-foreground";
const PILL_OFF = "bg-transparent text-muted-foreground hover:text-foreground border-border";

export function DeviceRequestsTable({ data, orgStructure }: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter]     = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter]         = useState<Set<string>>(new Set());
  const [reqTypeFilter, setReqTypeFilter]   = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(new Set());

  const makeToggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (key: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleStatus   = makeToggle(setStatusFilter);
  const toggleType     = makeToggle(setTypeFilter);
  const toggleReqType  = makeToggle(setReqTypeFilter);
  const togglePriority = makeToggle(setPriorityFilter);
  const [orgFilter, setOrgFilter] = useState("");
  const [heltesFilter, setHeltesFilter] = useState("");
  const [albaFilter, setAlbaFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);

  // Name lookup maps by bteg_id
  const orgByBteg = useMemo(
    () => Object.fromEntries(orgStructure.organizations.map(o => [o.bteg_id, o.name])),
    [orgStructure.organizations]
  );
  const heltesByBteg = useMemo(
    () => Object.fromEntries(orgStructure.heltes.map(h => [h.bteg_id, h.name])),
    [orgStructure.heltes]
  );
  const albaByBteg = useMemo(
    () => Object.fromEntries(orgStructure.alba.map(a => [a.bteg_id, a.name])),
    [orgStructure.alba]
  );

  // Filter cascade selects
  const selectedFilterOrg = orgStructure.organizations.find(o => o.id === orgFilter);
  const filterHeltesOptions = useMemo(
    () => selectedFilterOrg
      ? orgStructure.heltes.filter(h => h.org_bteg_id === selectedFilterOrg.bteg_id)
      : orgStructure.heltes,
    [selectedFilterOrg, orgStructure.heltes]
  );
  const selectedFilterHeltes = orgStructure.heltes.find(h => h.id === heltesFilter);
  const filterAlbaOptions = useMemo(
    () => selectedFilterHeltes
      ? orgStructure.alba.filter(a => a.heltes_bteg_id === selectedFilterHeltes.bteg_id)
      : selectedFilterOrg
      ? orgStructure.alba.filter(a => a.org_bteg_id === selectedFilterOrg.bteg_id)
      : orgStructure.alba,
    [selectedFilterHeltes, selectedFilterOrg, orgStructure.alba]
  );

  // Client-side filtering
  const filtered = useMemo(() => {
    return data.filter(r => {
      if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false;
      if (typeFilter.size > 0 && !typeFilter.has(r.device_type)) return false;
      if (reqTypeFilter.size > 0 && !reqTypeFilter.has(r.request_type)) return false;
      if (priorityFilter.size > 0 && !priorityFilter.has(r.priority ?? "normal")) return false;
      if (orgFilter) {
        const org = orgStructure.organizations.find(o => o.id === orgFilter);
        if (org && r.req_org_bteg !== org.bteg_id) return false;
      }
      if (heltesFilter) {
        const h = orgStructure.heltes.find(h => h.id === heltesFilter);
        if (h && r.req_heltes_bteg !== h.bteg_id) return false;
      }
      if (albaFilter) {
        const a = orgStructure.alba.find(a => a.id === albaFilter);
        if (a && r.req_alba_bteg !== a.bteg_id) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          r.creator?.name?.toLowerCase().includes(q) ||
          r.purpose?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, statusFilter, typeFilter, reqTypeFilter, priorityFilter, orgFilter, heltesFilter, albaFilter, search, orgStructure]);

  const columns: ColumnDef<Request>[] = [
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-2 h-8 font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Огноо <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "creator",
      header: "Гаргагч",
      cell: ({ row }) => {
        const r = row.original;
        const orgName = orgByBteg[r.req_org_bteg];
        const heltesName = heltesByBteg[r.req_heltes_bteg];
        const albaName = albaByBteg[r.req_alba_bteg];
        return (
          <div className="min-w-[150px]">
            <p className="text-sm font-medium">{r.creator?.name ?? "—"}</p>
            {orgName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {[orgName, heltesName].filter(Boolean).join(" / ")}
              </p>
            )}
            {albaName && (
              <p className="text-xs text-muted-foreground/70">{albaName}</p>
            )}
          </div>
        );
      },
    },
    {
      id: "device",
      header: "Төхөөрөмж",
      cell: ({ row }) => {
        const r = row.original;
        const typeCfg = DEVICE_TYPE_CONFIG[r.device_type as DeviceType];
        const reqCfg = REQUEST_TYPE_CONFIG[r.request_type as DeviceRequestType];
        return (
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <span className="text-sm font-medium">
              {typeCfg?.label ?? r.device_type ?? "—"}
              {r.fulfilled_by_request_id && (
                <Link2 className="inline-block ml-1.5 h-3 w-3 text-primary" />
              )}
            </span>
            <Badge variant="outline" className="text-xs w-fit">
              {reqCfg?.emoji} {reqCfg?.label ?? r.request_type}
            </Badge>
          </div>
        );
      },
    },
    {
      id: "priority",
      header: "Зэрэглэл",
      cell: ({ row }) => {
        const p = (row.original.priority ?? "normal") as DeviceRequestPriority;
        const cfg = PRIORITY_CONFIG[p];
        return (
          <Badge variant="outline" className={cn("text-xs whitespace-nowrap", cfg.className)}>
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      id: "assignee",
      header: "Хариуцагч",
      cell: ({ row }) => {
        const a = row.original.assignee;
        return a?.name
          ? <span className="text-xs text-muted-foreground">{a.name}</span>
          : <span className="text-xs text-muted-foreground/40">—</span>;
      },
    },
    {
      accessorKey: "purpose",
      header: "Зориулалт",
      cell: ({ row }) => (
        <span className="text-sm line-clamp-2 max-w-[180px] block">
          {row.original.purpose || "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-2 h-8 font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Төлөв <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const cfg = STATUS_CONFIG[row.original.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
        return (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className={cn("text-xs w-fit whitespace-nowrap", cfg.className)}>
              {cfg.label}
            </Badge>
            {row.original.admin_notes && (
              <p className="text-xs text-muted-foreground italic max-w-[140px] line-clamp-2">
                {row.original.admin_notes}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => router.push(`/devices/requests/${r.id}/edit`)}
              title="Засах"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-600 hover:border-blue-600 hover:text-white"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {r.status === "pending" && <DeviceRequestActions requestId={r.id} />}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const hasActiveFilters =
    statusFilter.size > 0 || typeFilter.size > 0 || reqTypeFilter.size > 0 || priorityFilter.size > 0 ||
    !!orgFilter || !!heltesFilter || !!albaFilter || !!search;

  function clearFilters() {
    setSearch("");
    setStatusFilter(new Set()); setTypeFilter(new Set());
    setReqTypeFilter(new Set()); setPriorityFilter(new Set());
    setOrgFilter(""); setHeltesFilter(""); setAlbaFilter("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Filter bar ─── */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Нэр, зориулалт хайх..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Цэвэрлэх
            </Button>
          )}
        </div>

        {/* Status — multi-select */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setStatusFilter(new Set())} className={cn(PILL, statusFilter.size === 0 ? PILL_ON : PILL_OFF)}>
            Бүгд
          </button>
          {(Object.entries(STATUS_CONFIG) as [string, { label: string }][]).map(([k, v]) => (
            <button key={k} onClick={() => toggleStatus(k)} className={cn(PILL, statusFilter.has(k) ? PILL_ON : PILL_OFF)}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Device type — multi-select */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTypeFilter(new Set())} className={cn(PILL, typeFilter.size === 0 ? PILL_ON : PILL_OFF)}>
            Бүх төхөөрөмж
          </button>
          {Object.entries(DEVICE_TYPE_CONFIG).map(([k, cfg]) => (
            <button key={k} onClick={() => toggleType(k)} className={cn(PILL, typeFilter.has(k) ? PILL_ON : PILL_OFF)}>
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Request type — multi-select */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setReqTypeFilter(new Set())} className={cn(PILL, reqTypeFilter.size === 0 ? PILL_ON : PILL_OFF)}>
            Бүх хүсэлт
          </button>
          {(Object.entries(REQUEST_TYPE_CONFIG) as [DeviceRequestType, typeof REQUEST_TYPE_CONFIG[DeviceRequestType]][]).map(([k, cfg]) => (
            <button key={k} onClick={() => toggleReqType(k)} className={cn(PILL, reqTypeFilter.has(k) ? PILL_ON : PILL_OFF)}>
              {cfg.emoji} {cfg.label}
            </button>
          ))}
        </div>

        {/* Priority + org cascade */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            <button onClick={() => setPriorityFilter(new Set())} className={cn(PILL, priorityFilter.size === 0 ? PILL_ON : PILL_OFF)}>
              Бүх зэрэглэл
            </button>
            {(Object.entries(PRIORITY_CONFIG) as [DeviceRequestPriority, typeof PRIORITY_CONFIG[DeviceRequestPriority]][]).map(([k, cfg]) => (
              <button key={k} onClick={() => togglePriority(k)} className={cn(PILL, priorityFilter.has(k) ? PILL_ON : PILL_OFF)}>
                {cfg.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 ml-auto">
            <Select
              value={orgFilter || ALL}
              onValueChange={v => { setOrgFilter(v === ALL ? "" : v); setHeltesFilter(""); setAlbaFilter(""); }}
            >
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Байгууллага" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Бүгд</SelectItem>
                {orgStructure.organizations.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={heltesFilter || ALL}
              disabled={!orgFilter}
              onValueChange={v => { setHeltesFilter(v === ALL ? "" : v); setAlbaFilter(""); }}
            >
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Хэлтэс" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Бүгд</SelectItem>
                {filterHeltesOptions.map(h => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={albaFilter || ALL}
              disabled={!heltesFilter}
              onValueChange={v => setAlbaFilter(v === ALL ? "" : v)}
            >
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Алба" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Бүгд</SelectItem>
                {filterAlbaOptions.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground px-1">{filtered.length} хүсэлт</p>

      {/* ─── Table ─── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                {hg.headers.map(h => (
                  <TableHead key={h.id} className="text-xs font-medium">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-16 text-muted-foreground text-sm">
                  Хүсэлт олдсонгүй
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="py-3 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Pagination ─── */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              filtered.length
            )}{" "}
            / {filtered.length}
          </p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0"
              onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0"
              onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
