"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
import JobDescSeeButton from "./job-desc-see-button";

interface JobDescription {
  id: string;
  title: string | null;
  a_code: string | null;
  job_position: JobPosition | JobPosition[] | null;
}

interface JobPosition {
  name: string | null;
}

const PAGE_SIZE = 15;

function getJobPositionName(jobPosition: JobDescription["job_position"]) {
  if (!jobPosition) return "Албан тушаал тодорхойгүй";
  const positions = Array.isArray(jobPosition) ? jobPosition : [jobPosition];
  const names = positions.map((p) => p.name || "").filter(Boolean);
  return names.length > 0 ? names.join(", ") : "Албан тушаал тодорхойгүй";
}

export default function JobDescriptionList() {
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchJobDescriptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      let query = supabase
        .from("job_description")
        .select("id, title, a_code, job_position:job_position_id(name)", {
          count: "exact",
        })
        .eq("is_deleted", false)
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)
        .order("id", { ascending: false });

      if (debouncedSearchTerm) {
        query = query.or(
          `title.ilike.%${debouncedSearchTerm}%,a_code.ilike.%${debouncedSearchTerm}%`,
        );
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setJobDescriptions((data || []) as JobDescription[]);
      setTotalCount(count ?? 0);
      setTotalPages(Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)));
    } catch (error) {
      toast.error(`Алдаа: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearchTerm]);

  useEffect(() => {
    fetchJobDescriptions();
  }, [fetchJobDescriptions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const goTo = (page: number) => {
    setCurrentPage(page);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Албан тушаал / Тодорхойлолт
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Албан тушаалын тодорхойлолтууд
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Бүртгэлтэй тодорхойлолт — нийт {totalCount} ширхэг
          </p>
        </div>
      </div>

      <Card className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Албан тушаалын нэр эсвэл кодоор хайх..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-4">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : jobDescriptions.length === 0 ? (
        <Card className="items-center gap-2 px-4 py-16 text-center">
          <BriefcaseBusiness className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">
            Тодорхойлолт олдсонгүй
          </p>
          <p className="text-sm text-muted-foreground">
            {debouncedSearchTerm
              ? "Хайлтын үр дүн байхгүй"
              : "Эхний албан тушаалын тодорхойлолт үүсгэснээр энд харагдана"}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <TooltipProvider delayDuration={150}>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-36">Код</TableHead>
                  <TableHead>Албан тушаал</TableHead>
                  <TableHead className="hidden md:table-cell">Гарчиг</TableHead>
                  <TableHead className="w-24 text-right">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobDescriptions.map((jobDescription) => {
                  const positionName = getJobPositionName(
                    jobDescription.job_position,
                  );
                  return (
                    <TableRow key={jobDescription.id}>
                      <TableCell className="text-sm font-medium tabular-nums text-muted-foreground">
                        {jobDescription.a_code || "Кодгүй"}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="truncate">{positionName}</span>
                              {jobDescription.a_code && (
                                <span className="truncate text-xs font-normal text-muted-foreground md:hidden">
                                  {jobDescription.a_code}
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="start"
                            className="max-w-md whitespace-normal">
                            <p className="font-semibold">{positionName}</p>
                            {jobDescription.title && (
                              <p className="mt-0.5 text-[11px] opacity-70">
                                {jobDescription.title}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        <span className="block truncate">
                          {jobDescription.title || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <JobDescSeeButton
                            job_description_id={jobDescription.id}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        </Card>
      )}

      {!isLoading && jobDescriptions.length > 0 && totalPages > 1 && (
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
                    onClick={() => goTo(1)}>
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
                    onClick={() => goTo(currentPage - 1)}>
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
                    onClick={() => goTo(currentPage + 1)}>
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
                    onClick={() => goTo(totalPages)}>
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
