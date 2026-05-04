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
  X,
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
  scopeTargets?: PolicyScopeTarget[];
}

interface PolicyScopeTarget {
  target_type: "heltes" | "alba";
  target_bteg_id: string;
  target_name: string | null;
  parent_bteg_id: string | null;
}

interface ScopeFilterOption {
  key: string;
  label: string;
  type: "heltes" | "alba";
  target_bteg_id: string;
}

const PAGE_SIZE = 15;

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PolicyList({ is_delete }: { is_delete?: boolean }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [scopeOptions, setScopeOptions] = useState<ScopeFilterOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeSearchTerm, setScopeSearchTerm] = useState("");
  const [selectedScopeKey, setSelectedScopeKey] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);
  const [debouncedScopeSearchTerm] = useDebounce(scopeSearchTerm, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm, selectedScopeKey]);

  useEffect(() => {
    fetchScopeOptions();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedScopeKey]);

  const fetchScopeOptions = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("policy_scope_targets")
        .select("target_type, target_bteg_id, target_name")
        .order("target_type")
        .order("target_name");

      if (error) throw error;

      const optionMap = new Map<string, ScopeFilterOption>();
      (data || []).forEach((scope) => {
        const key = `${scope.target_type}:${scope.target_bteg_id}`;
        if (optionMap.has(key)) return;
        optionMap.set(key, {
          key,
          type: scope.target_type,
          target_bteg_id: scope.target_bteg_id,
          label: scope.target_name || scope.target_bteg_id,
        });
      });

      setScopeOptions(
        Array.from(optionMap.values()).sort((a, b) => {
          const typeDiff =
            (a.type === "heltes" ? 0 : 1) - (b.type === "heltes" ? 0 : 1);
          if (typeDiff !== 0) return typeDiff;
          return a.label.localeCompare(b.label);
        }),
      );
    } catch (error) {
      toast.error(`Алба, хэлтсийн жагсаалт авахад алдаа: ${(error as Error).message}`);
    }
  };

  const fetchPolicies = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      let scopedPolicyIds: string[] | null = null;

      if (selectedScopeKey) {
        const [targetType, targetBtegId] = selectedScopeKey.split(":");
        const { data: scopedPolicies, error: scopedError } = await supabase
          .from("policy_scope_targets")
          .select("policy_id")
          .eq("target_type", targetType)
          .eq("target_bteg_id", targetBtegId);

        if (scopedError) throw scopedError;

        scopedPolicyIds = Array.from(
          new Set((scopedPolicies || []).map((row) => row.policy_id)),
        );

        if (scopedPolicyIds.length === 0) {
          setPolicies([]);
          setTotalCount(0);
          setTotalPages(1);
          return;
        }
      }

      let query = supabase
        .from("policy")
        .select("id, name, approved_date, reference_code", { count: "exact" })
        .ilike("name", `%${debouncedSearchTerm}%`)
        .eq("is_deleted", false);

      if (scopedPolicyIds) {
        query = query.in("id", scopedPolicyIds);
      }

      const { data, error, count } = await query
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)
        .order("approved_date", { ascending: false });

      if (error) throw error;

      const policyRows = data || [];
      const policyIds = policyRows.map((policy) => policy.id);
      let scopesByPolicy = new Map<string, PolicyScopeTarget[]>();

      if (policyIds.length > 0) {
        const { data: scopes, error: scopesError } = await supabase
          .from("policy_scope_targets")
          .select(
            "policy_id, target_type, target_bteg_id, target_name, parent_bteg_id",
          )
          .in("policy_id", policyIds)
          .order("target_type")
          .order("target_name");

        if (scopesError) throw scopesError;

        scopesByPolicy = (scopes || []).reduce((acc, scope) => {
          const current = acc.get(scope.policy_id) ?? [];
          current.push({
            target_type: scope.target_type,
            target_bteg_id: scope.target_bteg_id,
            target_name: scope.target_name,
            parent_bteg_id: scope.parent_bteg_id,
          });
          acc.set(scope.policy_id, current);
          return acc;
        }, new Map<string, PolicyScopeTarget[]>());
      }

      setPolicies(
        policyRows.map((policy) => ({
          ...policy,
          scopeTargets: scopesByPolicy.get(policy.id) ?? [],
        })),
      );
      setTotalCount(count ?? 0);
      setTotalPages(Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)));
    } catch (error) {
      toast.error(`Алдаа: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredScopeOptions = scopeOptions.filter((option) => {
    const query = debouncedScopeSearchTerm.toLowerCase();
    if (!query) return true;
    return option.label.toLowerCase().includes(query);
  });

  const selectedScope = scopeOptions.find(
    (option) => option.key === selectedScopeKey,
  );

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

      <Card className="space-y-3 px-4 py-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Журмын нэрээр хайх..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative lg:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Алба, хэлтсээр хайх..."
              className="pl-9 pr-9"
              value={scopeSearchTerm}
              onChange={(e) => setScopeSearchTerm(e.target.value)}
            />
            {scopeSearchTerm && (
              <button
                type="button"
                onClick={() => setScopeSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {(scopeSearchTerm || selectedScope) && (
          <div className="space-y-2 border-t pt-3">
            <div className="max-h-44 overflow-y-auto rounded-md border">
            <button
              type="button"
              onClick={() => setSelectedScopeKey("")}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                !selectedScopeKey ? "bg-muted font-medium" : ""
              }`}>
              Бүх алба, хэлтэс
              <span className="text-xs text-muted-foreground">
                {scopeOptions.length}
              </span>
            </button>
            {filteredScopeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedScopeKey(option.key)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted ${
                  selectedScopeKey === option.key ? "bg-muted font-medium" : ""
                }`}>
                <span className="min-w-0 truncate">{option.label}</span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {option.type === "heltes" ? "Хэлтэс" : "Алба"}
                </span>
              </button>
            ))}
            {filteredScopeOptions.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                Алба, хэлтэс олдсонгүй
              </div>
            )}
          </div>
          {selectedScope && (
            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
              <span className="truncate">
                Сонгосон: {selectedScope.label}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => setSelectedScopeKey("")}>
                Цэвэрлэх
              </Button>
            </div>
          )}
          </div>
        )}
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
