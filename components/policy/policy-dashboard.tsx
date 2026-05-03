"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Briefcase,
  FileText,
  Filter,
  ListChecks,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PolicyStatCards } from "@/components/policy/policy-stat-cards";
import { PolicyTable } from "@/components/policy/policy-table";
import { PolicyImplementationChart } from "@/components/policy/policy-implementation-chart";
import PolicyDetailSheet from "@/components/policy/policy-stats-sheet";
import { PositionPerfTable } from "@/components/policy/position-perf-table";
import PositionPerfSheet from "@/components/policy/position-perf-sheet";
import type {
  JobPositionPerfItem,
  JobPositionPerfSummary,
  PolicyDashboardItem,
  PolicyDashboardSummary,
} from "@/lib/policy-utils";

type SortBy = "percent" | "name";
type Order = "asc" | "desc";

function SectionHeader({
  Icon,
  title,
  hint,
}: {
  Icon: React.ElementType;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-foreground" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function PoliciesView({
  policies,
  summary,
}: {
  policies: PolicyDashboardItem[];
  summary: PolicyDashboardSummary;
}) {
  const [sortBy, setSortBy] = useState<SortBy>("percent");
  const [order, setOrder] = useState<Order>("desc");
  const [showUnrated, setShowUnrated] = useState(true);
  const [selected, setSelected] = useState<PolicyDashboardItem | null>(null);

  const sortedPolicies = useMemo(() => {
    const filtered = showUnrated
      ? policies
      : policies.filter((p) => p.validCount > 0);
    return [...filtered].sort((a, b) => {
      const av = sortBy === "percent" ? a.implementationPercent : a.name;
      const bv = sortBy === "percent" ? b.implementationPercent : b.name;
      if (av === bv) return 0;
      const dir = av > bv ? 1 : -1;
      return order === "asc" ? dir : -dir;
    });
  }, [policies, sortBy, order, showUnrated]);

  const chartData = useMemo(
    () =>
      sortedPolicies.map((p) => ({
        name: p.name,
        value: p.implementationPercent,
      })),
    [sortedPolicies],
  );

  return (
    <div className="flex flex-col gap-8">
      <PolicyStatCards summary={summary} />

      <section className="space-y-3">
        <SectionHeader Icon={Filter} title="Шүүлтүүр" />
        <Card className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="show-unrated-policies"
              checked={showUnrated}
              onCheckedChange={setShowUnrated}
            />
            <Label
              htmlFor="show-unrated-policies"
              className="cursor-pointer select-none text-sm font-medium"
            >
              Үнэлгээ хийгдээгүй журмуудыг харуулах
              <Badge variant="secondary" className="ml-2 tabular-nums">
                {summary.unratedCount}
              </Badge>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortBy)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Хэрэгжилтээр</SelectItem>
                <SelectItem value="name">Нэрээр</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
              aria-label="Эрэмбийн чиглэл солих"
            >
              {order === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader
          Icon={ListChecks}
          title="Журмууд"
          hint={`${sortedPolicies.length} ширхэг · Дундаж ${summary.avgPercent}%`}
        />
        <PolicyTable
          policies={sortedPolicies}
          onSelect={setSelected}
          selectedId={selected?.id}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader Icon={BarChart3} title="Хэрэгжилтийн график" />
        <Card className="p-4">
          <PolicyImplementationChart data={chartData} />
        </Card>
      </section>

      <PolicyDetailSheet
        policy={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

function PositionsView({
  positions,
  summary,
}: {
  positions: JobPositionPerfItem[];
  summary: JobPositionPerfSummary;
}) {
  const [sortBy, setSortBy] = useState<SortBy>("percent");
  const [order, setOrder] = useState<Order>("desc");
  const [showUnrated, setShowUnrated] = useState(true);
  const [selected, setSelected] = useState<JobPositionPerfItem | null>(null);

  const sortedPositions = useMemo(() => {
    const filtered = showUnrated
      ? positions
      : positions.filter((p) => p.validCount > 0);
    return [...filtered].sort((a, b) => {
      const av = sortBy === "percent" ? a.implementationPercent : a.name;
      const bv = sortBy === "percent" ? b.implementationPercent : b.name;
      if (av === bv) return 0;
      const dir = av > bv ? 1 : -1;
      return order === "asc" ? dir : -dir;
    });
  }, [positions, sortBy, order, showUnrated]);

  const chartData = useMemo(
    () =>
      sortedPositions.slice(0, 20).map((p) => ({
        name: p.name,
        value: p.implementationPercent,
      })),
    [sortedPositions],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Нийт ажлын байр
            </p>
            <div className="rounded-lg bg-blue-50 p-2 ring-1 ring-blue-100">
              <Briefcase className="h-4 w-4 text-blue-500" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {summary.total}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground">Үнэлсэн</p>
            <div className="rounded-lg bg-emerald-50 p-2 ring-1 ring-emerald-100">
              <ListChecks className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {summary.ratedCount}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Хүлээлтэнд
            </p>
            <div className="rounded-lg bg-amber-50 p-2 ring-1 ring-amber-100">
              <Filter className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {summary.unratedCount}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Дундаж хэрэгжилт
            </p>
            <div className="rounded-lg bg-violet-50 p-2 ring-1 ring-violet-100">
              <BarChart3 className="h-4 w-4 text-violet-500" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {summary.avgPercent}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              %
            </span>
          </p>
        </Card>
      </div>

      <section className="space-y-3">
        <SectionHeader Icon={Filter} title="Шүүлтүүр" />
        <Card className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="show-unrated-positions"
              checked={showUnrated}
              onCheckedChange={setShowUnrated}
            />
            <Label
              htmlFor="show-unrated-positions"
              className="cursor-pointer select-none text-sm font-medium"
            >
              Үнэлгээгүй ажлын байрыг харуулах
              <Badge variant="secondary" className="ml-2 tabular-nums">
                {summary.unratedCount}
              </Badge>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortBy)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Хэрэгжилтээр</SelectItem>
                <SelectItem value="name">Нэрээр</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
              aria-label="Эрэмбийн чиглэл солих"
            >
              {order === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader
          Icon={Briefcase}
          title="Ажлын байрууд"
          hint={`${sortedPositions.length} ширхэг · Дундаж ${summary.avgPercent}%`}
        />
        <PositionPerfTable
          positions={sortedPositions}
          onSelect={setSelected}
          selectedId={selected?.id}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader
          Icon={BarChart3}
          title="Хэрэгжилтийн график"
          hint={
            sortedPositions.length > 20 ? "Эхний 20 ажлын байр" : undefined
          }
        />
        <Card className="p-4">
          <PolicyImplementationChart data={chartData} />
        </Card>
      </section>

      <PositionPerfSheet
        position={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

export function PolicyDashboard({
  policies,
  summary,
  positions,
  positionSummary,
}: {
  policies: PolicyDashboardItem[];
  summary: PolicyDashboardSummary;
  positions: JobPositionPerfItem[];
  positionSummary: JobPositionPerfSummary;
}) {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Аудит / Хяналт
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Журмын хэрэгжилт
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Бүх журмын хэрэгжилтийн үнэлгээ ба аудит тайлан
        </p>
      </div>

      <Tabs defaultValue="policies" className="gap-6">
        <TabsList>
          <TabsTrigger value="policies">
            <FileText className="h-4 w-4" />
            Журмаар
          </TabsTrigger>
          <TabsTrigger value="positions">
            <Briefcase className="h-4 w-4" />
            Ажлын байраар
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policies">
          <PoliciesView policies={policies} summary={summary} />
        </TabsContent>
        <TabsContent value="positions">
          <PositionsView positions={positions} summary={positionSummary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
