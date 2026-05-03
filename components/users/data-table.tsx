"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
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
import { EmployeeDetailDialog } from "./employee-detail-dialog";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Users,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EmployeeRow = {
  id: string;
  bteg_id?: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  register_number: string | null;
  department_name: string | null;
  heltes_name: string | null;
  position_name: string | null;
  organization_name: string | null;
};

interface DataTableProps<TData extends EmployeeRow, TValue> {
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

const EMPTY_FILTERS = {
  lastName: "",
  firstName: "",
  organization: "",
  phone: "",
  position: "",
  department: "",
  register: "",
};

type EmployeeFilters = typeof EMPTY_FILTERS;

function matchesText(value: unknown, query: string) {
  if (!query) return true;
  return String(value ?? "")
    .toLowerCase()
    .includes(query.toLowerCase());
}

interface FilterInputProps {
  label: string;
  placeholder: string;
  value: string;
  list?: string;
  onChange: React.Dispatch<string>;
}

function FilterInput({
  label,
  placeholder,
  value,
  onChange,
  list,
}: FilterInputProps) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 bg-card pr-9 text-sm font-normal text-foreground"
          list={list}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={`${label} цэвэрлэх`}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </label>
  );
}

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function DataTable<TData extends EmployeeRow, TValue>({
  columns,
  data,
  permissions,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [filters, setFilters] = React.useState<EmployeeFilters>(EMPTY_FILTERS);
  const [selectedEmployee, setSelectedEmployee] =
    React.useState<EmployeeRow | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const suggestions = React.useMemo(() => {
    const organizations = new Set<string>();
    const departments = new Set<string>();
    const positions = new Set<string>();
    data.forEach((u) => {
      if (u.organization_name) organizations.add(u.organization_name);
      if (u.department_name) departments.add(u.department_name);
      if (u.heltes_name) departments.add(u.heltes_name);
      if (u.position_name) positions.add(u.position_name);
    });
    return {
      organizations: Array.from(organizations).sort(),
      departments: Array.from(departments).sort(),
      positions: Array.from(positions).sort(),
    };
  }, [data]);

  const filteredData = React.useMemo(() => {
    const rows = data.filter((u) => {
      const departmentText = [u.department_name, u.heltes_name]
        .filter(Boolean)
        .join(" ");

      return (
        matchesText(u.last_name, filters.lastName) &&
        matchesText(u.first_name, filters.firstName) &&
        matchesText(u.organization_name, filters.organization) &&
        matchesText(u.phone, filters.phone) &&
        matchesText(u.position_name, filters.position) &&
        matchesText(departmentText, filters.department)
      );
    });

    return rows as TData[];
  }, [data, filters]);

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

  const hasFilters = Object.values(filters).some(Boolean);
  const setFilter = (key: keyof EmployeeFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalFiltered = table.getFilteredRowModel().rows.length;
  const from = pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalFiltered);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterInput
          label="Овог"
          placeholder="Овгоор хайх"
          value={filters.lastName}
          onChange={(value) => setFilter("lastName", value)}
        />
        <FilterInput
          label="Нэр"
          placeholder="Нэрээр хайх"
          value={filters.firstName}
          onChange={(value) => setFilter("firstName", value)}
        />
        <FilterInput
          label="Компани"
          placeholder="Компаниар хайх"
          value={filters.organization}
          onChange={(value) => setFilter("organization", value)}
          list="employee-org-list"
        />
        <FilterInput
          label="Утас"
          placeholder="Утсаар хайх"
          value={filters.phone}
          onChange={(value) => setFilter("phone", value)}
        />
        <FilterInput
          label="Албан тушаал"
          placeholder="Албан тушаалаар хайх"
          value={filters.position}
          onChange={(value) => setFilter("position", value)}
          list="employee-position-list"
        />
        <FilterInput
          label="Алба, хэлтэс"
          placeholder="Алба, хэлтсээр хайх"
          value={filters.department}
          onChange={(value) => setFilter("department", value)}
          list="employee-dept-list"
        />
        {hasFilters && (
          <Button
            variant="ghost"
            className="h-9 self-end gap-1.5 text-xs text-muted-foreground"
            onClick={clearFilters}>
            <X className="h-3.5 w-3.5" />
            Цуцлах
          </Button>
        )}
        <datalist id="employee-org-list">
          {suggestions.organizations.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <datalist id="employee-position-list">
          {suggestions.positions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <datalist id="employee-dept-list">
          {suggestions.departments.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{totalFiltered}</span>{" "}
          ажилтан
          {hasFilters && (
            <span className="text-muted-foreground/60">
              {" "}
              ({data.length}-с шүүсэн)
            </span>
          )}
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden rounded-xl border border-border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 pl-4" />
              <TableHead className="font-semibold">Овог нэр</TableHead>
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
                    <p className="mt-1 text-sm text-muted-foreground">
                      Хайлтын утгаа өөрчилж дахин оролдоно уу
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const u = row.original;
                const initials = getInitials(u.first_name, u.last_name);
                const colorClass = avatarColor(initials);
                return (
                  <TableRow
                    key={row.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => {
                      setSelectedEmployee(u);
                      setIsDialogOpen(true);
                    }}>
                    <TableCell className="pl-4">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                          colorClass,
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
            const u = row.original;
            const initials = getInitials(u.first_name, u.last_name);
            const colorClass = avatarColor(initials);
            return (
              <button
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm"
                onClick={() => {
                  setSelectedEmployee(u);
                  setIsDialogOpen(true);
                }}>
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    colorClass,
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
            <span className="text-muted-foreground/60">
              {" "}
              / {totalFiltered} ажилтан
            </span>
          </p>
          <div className="flex items-center gap-1">
            {[
              {
                icon: ChevronsLeft,
                label: "Эхний",
                action: () => table.setPageIndex(0),
                disabled: !table.getCanPreviousPage(),
              },
              {
                icon: ChevronLeft,
                label: "Өмнөх",
                action: () => table.previousPage(),
                disabled: !table.getCanPreviousPage(),
              },
            ].map(({ icon: Icon, label, action, disabled }) => (
              <Button
                key={label}
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={action}
                disabled={disabled}
                aria-label={label}>
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
            <span className="px-3 text-sm font-medium tabular-nums">
              {pageIndex + 1}
              <span className="text-muted-foreground">
                {" "}
                / {table.getPageCount()}
              </span>
            </span>
            {[
              {
                icon: ChevronRight,
                label: "Дараагийн",
                action: () => table.nextPage(),
                disabled: !table.getCanNextPage(),
              },
              {
                icon: ChevronsRight,
                label: "Сүүлийн",
                action: () => table.setPageIndex(table.getPageCount() - 1),
                disabled: !table.getCanNextPage(),
              },
            ].map(({ icon: Icon, label, action, disabled }) => (
              <Button
                key={label}
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={action}
                disabled={disabled}
                aria-label={label}>
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
