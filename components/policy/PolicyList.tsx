"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/utils/supabase/client";
import PolicySeeButton from "./PolicySeeButton";
import PolicyDeleteButton from "./PolicyDeleteButton";

interface Policy {
  id: string;
  name: string | null;
  approved_date: string | null;
  reference_code: string | null;
}

const PAGE_SIZE = 15;

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PolicyList({ is_delete }: { is_delete?: boolean }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm]);

  const fetchPolicies = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error, count } = await supabase
        .from("policy")
        .select("id, name, approved_date, reference_code", { count: "exact" })
        .ilike("name", `%${debouncedSearchTerm}%`)
        .eq("is_deleted", false)
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)
        .order("approved_date", { ascending: false });

      if (error) throw error;

      setPolicies(data || []);
      setTotalCount(count ?? 0);
      setTotalPages(Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)));
    } catch (error) {
      toast.error(`Алдаа: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const goTo = (page: number) => {
    setCurrentPage(page);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Журам / Жагсаалт
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Бүртгэлтэй журмууд
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Идэвхтэй журмын бүртгэл — нийт {totalCount} ширхэг
          </p>
        </div>
        <Button asChild>
          <Link href="/policy/new">
            <Plus className="h-4 w-4" />
            Шинэ журам
          </Link>
        </Button>
      </div>

      {/* Search */}
      <Card className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Журмын нэрээр хайх..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card className="p-4">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : policies.length === 0 ? (
        <Card className="items-center gap-2 px-4 py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">Журам олдсонгүй</p>
          <p className="text-sm text-muted-foreground">
            {debouncedSearchTerm
              ? "Хайлтын үр дүн байхгүй"
              : "Эхний журам үүсгэснээр энд харагдана"}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <TooltipProvider delayDuration={150}>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Журмын нэр</TableHead>
                  <TableHead className="w-36">Баталсан огноо</TableHead>
                  <TableHead className="w-28 text-right">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-semibold text-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate">
                              {policy.name || "Нэргүй"}
                            </span>
                            {policy.reference_code && (
                              <span className="truncate text-xs font-normal text-muted-foreground">
                                {policy.reference_code}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          className="max-w-md whitespace-normal"
                        >
                          <p className="font-semibold">
                            {policy.name || "Нэргүй"}
                          </p>
                          {policy.reference_code && (
                            <p className="mt-0.5 text-[11px] opacity-70">
                              {policy.reference_code}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {formatDate(policy.approved_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <PolicySeeButton policy_id={policy.id} />
                        <PolicyDeleteButton
                          policy_id={policy.id}
                          onDeleted={fetchPolicies}
                          canDelete={is_delete}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && policies.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, totalCount)} / {totalCount}
          </p>
          <TooltipProvider delayDuration={150}>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage === 1}
                    onClick={() => goTo(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                    <span className="sr-only">Эхний хуудас</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Эхний хуудас</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage === 1}
                    onClick={() => goTo(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Өмнөх</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Өмнөх</TooltipContent>
              </Tooltip>
              <span className="px-2 text-xs font-medium tabular-nums text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage === totalPages}
                    onClick={() => goTo(currentPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Дараагийн</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Дараагийн</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={currentPage === totalPages}
                    onClick={() => goTo(totalPages)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                    <span className="sr-only">Сүүлийн хуудас</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Сүүлийн хуудас</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
