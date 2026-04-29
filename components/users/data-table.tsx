"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmployeeDetailDialog } from "./employee-detail-dialog";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Users,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  permissions: {
    canReadUserDetail: boolean;
    canReadDine: boolean;
    canEditDine: boolean;
    canManageActions: boolean;
  };
}

function getInitials(first: string | null, last: string | null) {
  const f = first?.[0] ?? "";
  const l = last?.[0] ?? "";
  return (l + f).toUpperCase() || "?";
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function DataTable<TData, TValue>({
  columns,
  data,
  permissions,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalSearch, setGlobalSearch] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("");
  const [selectedEmployee, setSelectedEmployee] = React.useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  // Derive unique departments for suggestions
  const departments = React.useMemo(() => {
    const set = new Set<string>();
    (data as any[]).forEach((u) => { if (u.department_name) set.add(u.department_name); });
    return Array.from(set).sort();
  }, [data]);

  // Client-side multi-field filter
  const filteredData = React.useMemo(() => {
    let rows = data as any[];
    if (globalSearch) {
      const q = globalSearch.toLowerCase();
      rows = rows.filter((u) =>
        [
          u.first_name,
          u.last_name,
          `${u.last_name} ${u.first_name}`,
          `${u.first_name} ${u.last_name}`,
          u.position_name,
          u.phone,
          u.register_number,
          u.organization_name,
        ].some((v) => v?.toLowerCase().includes(q))
      );
    }
    if (deptFilter) {
      const q = deptFilter.toLowerCase();
      rows = rows.filter((u) =>
        u.department_name?.toLowerCase().includes(q) ||
        u.heltes_name?.toLowerCase().includes(q)
      );
    }
    return rows as TData[];
  }, [data, globalSearch, deptFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { columnFilters },
    initialState: { pagination: { pageSize: 20 } },
  });

  const hasFilters = globalSearch || deptFilter;
  const clearFilters = () => { setGlobalSearch(""); setDeptFilter(""); };

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalFiltered = table.getFilteredRowModel().rows.length;
  const from = pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalFiltered);

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Нэр, утас, регистр, байгууллагаар хайх..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="h-9 bg-card pl-9 pr-9"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="relative sm:w-56">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Алба, хэлтсээр хайх..."
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-9 bg-card pl-9 pr-9"
            list="dept-list"
          />
          <datalist id="dept-list">
            {departments.map((d) => <option key={d} value={d} />)}
          </datalist>
          {deptFilter && (
            <button
              onClick={() => setDeptFilter("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs text-muted-foreground" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" />
            Цуцлах
          </Button>
        )}
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{totalFiltered}</span> ажилтан
          {hasFilters && <span className="text-muted-foreground/60"> ({(data as any[]).length}-с шүүсэн)</span>}
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden rounded-xl border border-border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 pl-4" />
              <TableHead className="font-semibold">Ажилтан</TableHead>
              <TableHead className="font-semibold">Алба, хэлтэс</TableHead>
              <TableHead className="font-semibold">Албан тушаал</TableHead>
              <TableHead className="font-semibold">Утас</TableHead>
              <TableHead className="pr-4 font-semibold">Байгуулага</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                      <Users className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                    <p className="font-medium">Ажилтан олдсонгүй</p>
                    <p className="mt-1 text-sm text-muted-foreground">Хайлтын утгаа өөрчилж дахин оролдоно уу</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const u = row.original as any;
                const initials = getInitials(u.first_name, u.last_name);
                const colorClass = avatarColor(initials);
                return (
                  <TableRow
                    key={row.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => { setSelectedEmployee(u); setIsDialogOpen(true); }}
                  >
                    <TableCell className="pl-4">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                        colorClass
                      )}>
                        {initials}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {u.last_name} {u.first_name}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.department_name || u.heltes_name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.position_name || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {u.phone || "—"}
                    </TableCell>
                    <TableCell className="pr-4 text-sm text-muted-foreground">
                      {u.organization_name || "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-2 sm:hidden">
        {table.getRowModel().rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <Users className="mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium">Ажилтан олдсонгүй</p>
          </div>
        ) : (
          table.getRowModel().rows.map((row) => {
            const u = row.original as any;
            const initials = getInitials(u.first_name, u.last_name);
            const colorClass = avatarColor(initials);
            return (
              <button
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm"
                onClick={() => { setSelectedEmployee(u); setIsDialogOpen(true); }}
              >
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  colorClass
                )}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {u.last_name} {u.first_name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {u.position_name || "—"}
                    {u.department_name ? ` · ${u.department_name}` : ""}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-muted-foreground/40" />
              </button>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {from}–{to}
            <span className="text-muted-foreground/60"> / {totalFiltered} ажилтан</span>
          </p>
          <div className="flex items-center gap-1">
            {[
              { icon: ChevronsLeft, label: "Эхний", action: () => table.setPageIndex(0), disabled: !table.getCanPreviousPage() },
              { icon: ChevronLeft, label: "Өмнөх", action: () => table.previousPage(), disabled: !table.getCanPreviousPage() },
            ].map(({ icon: Icon, label, action, disabled }) => (
              <Button key={label} variant="outline" size="icon" className="h-8 w-8" onClick={action} disabled={disabled} aria-label={label}>
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
            <span className="px-3 text-sm font-medium tabular-nums">
              {pageIndex + 1}
              <span className="text-muted-foreground"> / {table.getPageCount()}</span>
            </span>
            {[
              { icon: ChevronRight, label: "Дараагийн", action: () => table.nextPage(), disabled: !table.getCanNextPage() },
              { icon: ChevronsRight, label: "Сүүлийн", action: () => table.setPageIndex(table.getPageCount() - 1), disabled: !table.getCanNextPage() },
            ].map(({ icon: Icon, label, action, disabled }) => (
              <Button key={label} variant="outline" size="icon" className="h-8 w-8" onClick={action} disabled={disabled} aria-label={label}>
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>
        </div>
      )}

      <EmployeeDetailDialog
        employee={selectedEmployee}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        permissions={permissions}
      />
    </div>
  );
}
