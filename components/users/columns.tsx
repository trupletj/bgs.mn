"use client";

import { ColumnDef } from "@tanstack/react-table";

export type User = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  register_number: string | null;
  department_name: string | null;
  heltes_name: string | null;
  position_name: string | null;
  is_active: boolean | null;
  organization_name: string | null;
};

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "organization_name",
    header: "Байгууллага",
    cell: ({ row }) => row.original.organization_name || "-",
  },
  {
    accessorKey: "department_name",
    header: "Алба, хэлтэс",
    filterFn: (row, columnId, filterValue) => {
      const searchValue = filterValue.toLowerCase();
      const dept = String(row.original.department_name || "").toLowerCase();
      const heltes = String(row.original.heltes_name || "").toLowerCase();
      return dept.includes(searchValue) || heltes.includes(searchValue);
    },
    cell: ({ row }) => {
      const department_name = row.original.department_name || "";
      const heltes_name = row.original.heltes_name || "";
      if (!department_name && !heltes_name) return "Мэдээлэл алга";
      if (!department_name) return heltes_name;
      if (!heltes_name) return department_name;
      return `${department_name}, ${heltes_name}`;
    },
  },
  {
    accessorKey: "last_name",
    header: "Овог",
    cell: ({ row }) => row.original.last_name || "-",
  },
  {
    accessorKey: "first_name",
    header: "Нэр",
    cell: ({ row }) => row.original.first_name || "-",
  },
  {
    accessorKey: "position_name",
    header: "Албан тушаал",
  },
  {
    accessorKey: "phone",
    header: "Утас",
  },
];
