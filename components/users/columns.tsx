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
};

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "department_name",
    header: "Алба, хэлтэс",
    filterFn: (row, columnId, filterValue) => {
      const searchValue = filterValue.toLowerCase();
      const dept = String(row.original.department_name || "").toLowerCase();
      const heltes = String(row.original.heltes_name || "").toLowerCase();

      // Аль нэгэнд нь л хайлтын үг байвал True буцаана (OR logic)
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
    accessorKey: "first_name",
    header: "Нэр",
    cell: ({ row }) => {
      const first = row.original.first_name || "";
      const last = row.original.last_name || "";
      return `${last.charAt(0)}. ${first}`;
    },
  },
  {
    accessorKey: "position_name",
    header: "Албан тушаал",
  },
  {
    accessorKey: "phone",
    header: "Утас",
  },
  // {
  //   accessorKey: "is_active",
  //   header: "Төлөв",
  //   cell: ({ row }) => {
  //     const active = row.getValue("is_active");
  //     return (
  //       <Badge variant={active ? "default" : "destructive"}>
  //         {active ? "Идэвхтэй" : "Идэвхгүй"}
  //       </Badge>
  //     );
  //   },
  // },
];
