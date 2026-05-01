"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Search, X, ExternalLink, Building2,
  Cpu, Laptop2, Monitor as MonitorIcon, Printer as PrinterIcon, ScanLine,
} from "lucide-react";
import { DEVICE_TYPE_CONFIG, DEVICE_STATUS_CONFIG, type DeviceStatus } from "@/types/device";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Device, DeviceType, OrgStructure } from "@/types/device";

type Row = Device & {
  organization?: { id: string; name: string } | null;
  heltes?: { id: string; name: string } | null;
  alba?: { id: string; name: string } | null;
};

function formatDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  desktop: Cpu,
  laptop:  Laptop2,
  monitor: MonitorIcon,
  printer: PrinterIcon,
  scanner: ScanLine,
};
const TYPE_COLORS: Record<string, string> = {
  desktop: "text-indigo-600 bg-indigo-50 border-indigo-200",
  laptop:  "text-cyan-600 bg-cyan-50 border-cyan-200",
  monitor: "text-emerald-600 bg-emerald-50 border-emerald-200",
  printer: "text-amber-600 bg-amber-50 border-amber-200",
  scanner: "text-orange-600 bg-orange-50 border-orange-200",
};

function TypeIcon({ type, size = "md", subtitle }: { type: string; size?: "sm" | "md"; subtitle?: string }) {
  const Icon = TYPE_ICONS[type] ?? Cpu;
  const label = DEVICE_TYPE_CONFIG[type as DeviceType]?.label ?? type;
  const cls = TYPE_COLORS[type] ?? "text-muted-foreground bg-muted/40 border-border";
  const dim = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const iconDim = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center justify-center rounded-md border", dim, cls)}>
          <Icon className={iconDim} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="font-medium">{label}</span>
        {subtitle && <span className="text-xs opacity-80 block">{subtitle}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function SortButton({ column, children }: { column: any; children: React.ReactNode }) {
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    </button>
  );
}

function buildColumns(pairedChildren: Map<string, Row[]>): ColumnDef<Row>[] {
 return [
  {
    id: "name",
    accessorFn: (r) => r.name,
    header: ({ column }) => <SortButton column={column}>Нэр / Загвар</SortButton>,
    cell: ({ row }) => {
      const d = row.original;
      return (
        <Link href={`/devices/${d.id}`} className="group flex flex-col gap-0.5 hover:text-primary">
          <span className="font-medium leading-tight group-hover:underline">{d.name}</span>
          {d.model && <span className="text-xs text-muted-foreground">{d.model}</span>}
          {d.manufacturer && <span className="text-xs text-muted-foreground/70">{d.manufacturer}</span>}
        </Link>
      );
    },
  },
  {
    id: "device_type",
    accessorFn: (r) => r.device_type,
    header: "Төрөл",
    cell: ({ row }) => {
      const d = row.original;
      const children = pairedChildren.get(d.id) ?? [];
      return (
        <div className="flex items-center gap-1.5">
          <TypeIcon type={d.device_type} />
          {children.length > 0 && (
            <div title={`${children.length} холбогдсон төхөөрөмж`} className="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-border/60">
              {children.slice(0, 4).map((c) => (
                <TypeIcon key={c.id} type={c.device_type} size="sm" subtitle={c.name} />
              ))}
              {children.length > 4 && (
                <span className="text-[10px] font-semibold text-muted-foreground ml-0.5">+{children.length - 4}</span>
              )}
            </div>
          )}
        </div>
      );
    },
    filterFn: (row, _id, value) => !value || row.original.device_type === value,
  },
  {
    id: "status",
    accessorFn: (r) => r.status,
    header: "Төлөв",
    cell: ({ row }) => {
      const cfg = DEVICE_STATUS_CONFIG[row.original.status as DeviceStatus] ?? DEVICE_STATUS_CONFIG.active;
      return (
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", cfg.className)}>
          {cfg.label}
        </span>
      );
    },
    filterFn: (row, _id, value) => !value || row.original.status === value,
  },
  {
    id: "serial_number",
    accessorFn: (r) => r.serial_number ?? "",
    header: "Серийн дугаар",
    cell: ({ row }) =>
      row.original.serial_number
        ? <span className="font-mono text-xs text-muted-foreground">{row.original.serial_number}</span>
        : <span className="text-muted-foreground/40">—</span>,
  },
  {
    id: "organization",
    accessorFn: (r) => (r as any).organization?.name ?? "",
    header: ({ column }) => <SortButton column={column}>Байгууллага</SortButton>,
    cell: ({ row }) => {
      const name = (row.original as any).organization?.name;
      return name
        ? <span className="text-xs text-muted-foreground">{name}</span>
        : <span className="text-muted-foreground/40">—</span>;
    },
  },
  {
    id: "heltes",
    accessorFn: (r) => (r as any).heltes?.name ?? "",
    header: ({ column }) => <SortButton column={column}>Хэлтэс</SortButton>,
    cell: ({ row }) => {
      const name = (row.original as any).heltes?.name;
      return name
        ? <span className="text-xs text-muted-foreground">{name}</span>
        : <span className="text-muted-foreground/40">—</span>;
    },
  },
  {
    id: "alba",
    accessorFn: (r) => (r as any).alba?.name ?? "",
    header: ({ column }) => <SortButton column={column}>Алба</SortButton>,
    cell: ({ row }) => {
      const name = (row.original as any).alba?.name;
      return name
        ? <span className="text-xs font-medium text-foreground/80">{name}</span>
        : <span className="text-muted-foreground/40">—</span>;
    },
  },
  {
    id: "assignee",
    header: "Хариуцагч",
    cell: ({ row }) => {
      const assignments = (row.original.device_assignments ?? []) as any[];
      const primary = assignments.find((a) => a.is_primary) ?? assignments[0];
      if (!primary?.user) return <span className="text-muted-foreground/40">—</span>;
      const u = primary.user;
      return (
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="font-medium text-foreground">{u.last_name} {u.first_name}</span>
          {u.position_name && <span className="text-muted-foreground">{u.position_name}</span>}
          {assignments.length > 1 && (
            <span className="text-muted-foreground/60">+{assignments.length - 1} бусад</span>
          )}
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Link
        href={`/devices/${row.original.id}`}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Дэлгэрэнгүй
      </Link>
    ),
  },
];
}

const NONE = "__none__";

interface Props {
  data: Row[];
  orgStructure: OrgStructure;
}

export function DevicesTable({ data, orgStructure }: Props) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  // Org/heltes/alba cascading filter
  const [orgId, setOrgId]       = React.useState("");
  const [heltesId, setHeltesId] = React.useState("");
  const [albaId, setAlbaId]     = React.useState("");

  const selectedOrgBtegId = orgId
    ? (orgStructure.organizations.find((o) => o.id === orgId)?.bteg_id ?? null)
    : null;
  const selectedHeltesBtegId = heltesId
    ? (orgStructure.heltes.find((h) => h.id === heltesId)?.bteg_id ?? null)
    : null;

  const filteredHeltes = React.useMemo(
    () => selectedOrgBtegId
      ? orgStructure.heltes.filter((h) => h.org_bteg_id === selectedOrgBtegId)
      : orgStructure.heltes,
    [selectedOrgBtegId, orgStructure.heltes]
  );
  const filteredAlba = React.useMemo(() => {
    if (selectedHeltesBtegId) return orgStructure.alba.filter((a) => a.heltes_bteg_id === selectedHeltesBtegId);
    if (selectedOrgBtegId)    return orgStructure.alba.filter((a) => a.org_bteg_id === selectedOrgBtegId);
    return orgStructure.alba;
  }, [selectedHeltesBtegId, selectedOrgBtegId, orgStructure.alba]);

  const handleOrgChange = (v: string) => {
    setOrgId(v === NONE ? "" : v);
    setHeltesId("");
    setAlbaId("");
  };
  const handleHeltesChange = (v: string) => {
    setHeltesId(v === NONE ? "" : v);
    setAlbaId("");
  };

  // Pre-filter data by org/heltes/alba before passing to tanstack
  const filteredData = React.useMemo(() => {
    return data.filter((d) => {
      if (albaId   && (d as any).alba?.id   !== albaId)   return false;
      if (heltesId && (d as any).heltes?.id !== heltesId) return false;
      if (orgId    && (d as any).organization?.id !== orgId) return false;
      return true;
    });
  }, [data, orgId, heltesId, albaId]);

  const hasOrgFilter = orgId || heltesId || albaId;

  // Build parent → children map (e.g., desktop → its monitors)
  const pairedChildren = React.useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const d of data) {
      const parent = (d as any).paired_with_device_id as string | null | undefined;
      if (!parent) continue;
      if (!m.has(parent)) m.set(parent, []);
      m.get(parent)!.push(d);
    }
    return m;
  }, [data]);

  const columns = React.useMemo(() => buildColumns(pairedChildren), [pairedChildren]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
    globalFilterFn: (row, _columnId, value) => {
      const v = value.toLowerCase();
      const d = row.original;
      return (
        d.name.toLowerCase().includes(v) ||
        (d.model ?? "").toLowerCase().includes(v) ||
        (d.serial_number ?? "").toLowerCase().includes(v) ||
        (d.manufacturer ?? "").toLowerCase().includes(v) ||
        ((d as any).organization?.name ?? "").toLowerCase().includes(v) ||
        ((d as any).heltes?.name ?? "").toLowerCase().includes(v) ||
        ((d as any).alba?.name ?? "").toLowerCase().includes(v) ||
        (d.device_assignments ?? []).some((a: any) =>
          `${a.user?.last_name ?? ""} ${a.user?.first_name ?? ""}`.toLowerCase().includes(v)
        )
      );
    },
  });

  const currentTypeFilter = (columnFilters.find((f) => f.id === "device_type")?.value as string) ?? "";
  const currentStatusFilter = (columnFilters.find((f) => f.id === "status")?.value as string) ?? "";

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar row 1: search + org filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Хайх: нэр, серийн дугаар, хариуцагч..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Org cascading selects */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={orgId || NONE} onValueChange={handleOrgChange}>
            <SelectTrigger className="h-8 text-xs w-[160px] gap-1">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Байгууллага" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Байгууллага бүгд</SelectItem>
              {orgStructure.organizations.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={heltesId || NONE}
            onValueChange={handleHeltesChange}
            disabled={filteredHeltes.length === 0}
          >
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue placeholder="Хэлтэс" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Хэлтэс бүгд</SelectItem>
              {filteredHeltes.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={albaId || NONE}
            onValueChange={(v) => setAlbaId(v === NONE ? "" : v)}
            disabled={filteredAlba.length === 0}
          >
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue placeholder="Алба" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Алба бүгд</SelectItem>
              {filteredAlba.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasOrgFilter && (
            <button
              onClick={() => { setOrgId(""); setHeltesId(""); setAlbaId(""); }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Арилгах
            </button>
          )}
        </div>

        <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
          {table.getFilteredRowModel().rows.length} / {data.length} тоног төхөөрөмж
        </span>
      </div>

      {/* Toolbar row 2: type filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setColumnFilters((prev) => prev.filter((f) => f.id !== "device_type"))}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            currentTypeFilter === ""
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          )}
        >
          Төрөл бүгд
        </button>
        {(["desktop", "laptop", "monitor", "printer", "scanner"] as const).map((value) => {
          const Icon = TYPE_ICONS[value];
          const label = DEVICE_TYPE_CONFIG[value]?.label ?? value;
          const colorClass = TYPE_COLORS[value];
          const active = currentTypeFilter === value;
          return (
            <button
              key={value}
              onClick={() =>
                setColumnFilters((prev) => [
                  ...prev.filter((f) => f.id !== "device_type"),
                  { id: "device_type", value },
                ])
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? cn("border-current shadow-sm", colorClass)
                  : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Toolbar row 3: status filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setColumnFilters((prev) => prev.filter((f) => f.id !== "status"))}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            currentStatusFilter === ""
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          )}
        >
          Төлөв бүгд
        </button>
        {(Object.entries(DEVICE_STATUS_CONFIG) as [DeviceStatus, { label: string; className: string }][]).map(([value, cfg]) => {
          const active = currentStatusFilter === value;
          return (
            <button
              key={value}
              onClick={() =>
                setColumnFilters((prev) => [
                  ...prev.filter((f) => f.id !== "status"),
                  { id: "status", value },
                ])
              }
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? cn("border-current shadow-sm", cfg.className)
                  : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent border-b border-border/60">
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-9 px-4 text-xs font-semibold text-muted-foreground whitespace-nowrap"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-muted-foreground">
                    Тохирох тоног төхөөрөмж олдсонгүй
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-3 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{" "}
            / {table.getFilteredRowModel().rows.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
