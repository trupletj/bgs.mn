"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileDown,
  Search,
} from "lucide-react";

import {
  getFoodDailyReportForExport,
  type DiningHallOption,
  type FoodDailyReportRow,
  type FoodMonthlyReportRow,
} from "@/actions/food-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  month: string;
  summary: FoodMonthlyReportRow[];
  dates: string[];
  diningHalls: DiningHallOption[];
}

interface CompanySummaryRow {
  org_name: string;
  is_contract: boolean;
  expected_count: number;
  actual_count: number;
  manual_override_total: number;
  extra_serving_total: number;
  wrong_location_total: number;
  detail_count: number;
}

const ALL_HALLS = "all";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Өглөөний цай",
  morning_meal: "Өглөөний хоол",
  lunch: "Өдрийн хоол",
  dinner: "Оройн хоол",
  night_meal: "Шөнийн хоол",
  extend_morning_meal: "Сунгасан өглөө",
  extend_lunch: "Сунгасан өдөр",
};

const SUMMARY_COLUMNS = [
  "Сар",
  "Байгууллага",
  "Ангилал",
  "Төлөвлөсөн",
  "Идсэн",
  "Зөрүү",
  "Гараар бүртгэсэн",
  "Нэмэлт порц",
  "Буруу байршил",
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("mn-MN").format(value);
}

function getMealLabel(mealType: string) {
  return MEAL_TYPE_LABELS[mealType] || mealType;
}

function getMonthLabel(month: string) {
  return month.replace("-", ".");
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("mn-MN");
}

function matchesFilters(
  row: FoodMonthlyReportRow | FoodDailyReportRow,
  selectedHall: string,
  search: string,
) {
  if (
    selectedHall !== ALL_HALLS &&
    row.dining_hall_id !== Number(selectedHall)
  ) {
    return false;
  }

  const query = normalizeSearch(search);
  if (!query) return true;

  return [
    row.org_name,
    row.dep_name,
    row.heltes_name,
    row.dining_hall_name || "",
  ]
    .join(" ")
    .toLocaleLowerCase("mn-MN")
    .includes(query);
}

function isContractRow(row: FoodMonthlyReportRow) {
  return row.dep_name === "Гэрээт" || row.heltes_name === "Гэрээт";
}

function buildCompanyExportRows(month: string, rows: CompanySummaryRow[]) {
  return rows.map((row) => ({
    Сар: getMonthLabel(month),
    Байгууллага: row.org_name,
    Ангилал: row.is_contract ? "Гэрээт" : "Үндсэн",
    Төлөвлөсөн: row.expected_count,
    Идсэн: row.actual_count,
    Зөрүү: row.actual_count - row.expected_count,
    "Гараар бүртгэсэн": row.manual_override_total,
    "Нэмэлт порц": row.extra_serving_total,
    "Буруу байршил": row.wrong_location_total,
  }));
}

function buildDetailExportRows(rows: FoodMonthlyReportRow[]) {
  return rows.map((row) => ({
    Сар: getMonthLabel(row.report_month.slice(0, 7)),
    "Гал тогоо": row.dining_hall_name || `Hall #${row.dining_hall_id}`,
    Байгууллага: row.org_name,
    Алба: row.dep_name,
    Хэлтэс: row.heltes_name,
    "Хоолны төрөл": getMealLabel(row.meal_type),
    Төлөвлөсөн: row.expected_count,
    Идсэн: row.actual_count,
    Зөрүү: row.actual_count - row.expected_count,
    "Гараар бүртгэсэн": row.manual_override_total,
    "Нэмэлт порц": row.extra_serving_total,
    "Буруу байршил": row.wrong_location_total,
  }));
}

function buildDailyExportRows(rows: FoodDailyReportRow[]) {
  return rows.map((row) => ({
    Өдөр: row.report_date,
    "Гал тогоо": row.dining_hall_name || `Hall #${row.dining_hall_id}`,
    Байгууллага: row.org_name,
    Алба: row.dep_name,
    Хэлтэс: row.heltes_name,
    "Хоолны төрөл": getMealLabel(row.meal_type),
    Төлөвлөсөн: row.expected_count,
    Идсэн: row.actual_count,
    Зөрүү: row.actual_count - row.expected_count,
    "Гараар бүртгэсэн": row.manual_override_total,
    "Нэмэлт порц": row.extra_serving_total,
    "Буруу байршил": row.wrong_location_total,
  }));
}

function buildCsv(rows: Record<string, string | number>[], columns: string[]) {
  const escapeValue = (value: string | number) => {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => escapeValue(row[column] ?? "")).join(","),
    ),
  ].join("\n");
}

export function MonthlyFoodReport({
  month,
  summary,
  dates,
  diningHalls,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [selectedHall, setSelectedHall] = useState(ALL_HALLS);
  const [search, setSearch] = useState("");
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    () => new Set(),
  );

  const filteredSummary = useMemo(
    () => summary.filter((row) => matchesFilters(row, selectedHall, search)),
    [summary, selectedHall, search],
  );

  const companyRows = useMemo(() => {
    const rows = new Map<string, CompanySummaryRow>();

    filteredSummary.forEach((row) => {
      const current =
        rows.get(row.org_name) ||
        ({
          org_name: row.org_name,
          is_contract: isContractRow(row),
          expected_count: 0,
          actual_count: 0,
          manual_override_total: 0,
          extra_serving_total: 0,
          wrong_location_total: 0,
          detail_count: 0,
        } satisfies CompanySummaryRow);

      current.expected_count += row.expected_count;
      current.actual_count += row.actual_count;
      current.manual_override_total += row.manual_override_total;
      current.extra_serving_total += row.extra_serving_total;
      current.wrong_location_total += row.wrong_location_total;
      current.detail_count += 1;
      current.is_contract = current.is_contract || isContractRow(row);
      rows.set(row.org_name, current);
    });

    return Array.from(rows.values()).sort(
      (a, b) => b.actual_count - a.actual_count,
    );
  }, [filteredSummary]);

  const detailByCompany = useMemo(() => {
    const rows = new Map<string, FoodMonthlyReportRow[]>();

    filteredSummary.forEach((row) => {
      const companyRows = rows.get(row.org_name) || [];
      companyRows.push(row);
      rows.set(row.org_name, companyRows);
    });

    rows.forEach((companyRows) => {
      companyRows.sort((a, b) => {
        const hallCompare = (a.dining_hall_name || "").localeCompare(
          b.dining_hall_name || "",
          "mn-MN",
        );
        if (hallCompare !== 0) return hallCompare;
        const depCompare = a.dep_name.localeCompare(b.dep_name, "mn-MN");
        if (depCompare !== 0) return depCompare;
        const heltesCompare = a.heltes_name.localeCompare(
          b.heltes_name,
          "mn-MN",
        );
        if (heltesCompare !== 0) return heltesCompare;
        return getMealLabel(a.meal_type).localeCompare(
          getMealLabel(b.meal_type),
          "mn-MN",
        );
      });
    });

    return rows;
  }, [filteredSummary]);

  const totals = useMemo(
    () =>
      companyRows.reduce(
        (acc, row) => {
          acc.expected += row.expected_count;
          acc.actual += row.actual_count;
          acc.manual += row.manual_override_total;
          acc.extra += row.extra_serving_total;
          acc.wrong += row.wrong_location_total;
          return acc;
        },
        { expected: 0, actual: 0, manual: 0, extra: 0, wrong: 0 },
      ),
    [companyRows],
  );

  const variance = totals.actual - totals.expected;
  const regularTotals = useMemo(
    () =>
      companyRows
        .filter((row) => !row.is_contract)
        .reduce(
          (acc, row) => {
            acc.expected += row.expected_count;
            acc.actual += row.actual_count;
            return acc;
          },
          { expected: 0, actual: 0 },
        ),
    [companyRows],
  );
  const contractTotals = useMemo(
    () =>
      companyRows
        .filter((row) => row.is_contract)
        .reduce(
          (acc, row) => {
            acc.expected += row.expected_count;
            acc.actual += row.actual_count;
            return acc;
          },
          { expected: 0, actual: 0 },
        ),
    [companyRows],
  );
  const regularVariance = regularTotals.actual - regularTotals.expected;
  const contractVariance = contractTotals.actual - contractTotals.expected;

  const updateMonth = (value: string) => {
    setSelectedMonth(value);
    setExpandedCompanies(new Set());
    startTransition(() => {
      router.push(`/dine/monthly-report?month=${value}`);
    });
  };

  const toggleCompany = (company: string) => {
    setExpandedCompanies((current) => {
      const next = new Set(current);
      if (next.has(company)) {
        next.delete(company);
      } else {
        next.add(company);
      }
      return next;
    });
  };

  const exportExcel = async () => {
    const dailyRows = await getFoodDailyReportForExport(selectedMonth);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        buildCompanyExportRows(selectedMonth, companyRows),
      ),
      "Компанийн тайлан",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(buildDetailExportRows(filteredSummary)),
      "Алба, Хэлтсийн тайлан",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(buildDailyExportRows(dailyRows)),
      "Өдөр тутмын тайлан",
    );

    const file = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([file], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `food-monthly-report-${selectedMonth}.xlsx`,
    );
  };

  const exportCsv = () => {
    const csv = `\uFEFF${buildCsv(
      buildCompanyExportRows(selectedMonth, companyRows),
      SUMMARY_COLUMNS,
    )}`;
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `food-monthly-report-${selectedMonth}.csv`,
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Сарын хоолны тайлан
          </h1>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={exportCsv}
            disabled={companyRows.length === 0}>
            <FileDown data-icon="inline-start" />
            CSV
          </Button>
          <Button
            type="button"
            onClick={exportExcel}
            disabled={companyRows.length === 0}>
            <Download data-icon="inline-start" />
            Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Шүүлтүүр</CardTitle>
          <CardDescription>
            Сар, гал тогоо, байгууллага/алба/хэлтсээр шүүнэ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[180px_240px_1fr]">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(event) => updateMonth(event.target.value)}
              aria-label="Сар сонгох"
              disabled={isPending}
            />

            <Select value={selectedHall} onValueChange={setSelectedHall}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Гал тогоо" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL_HALLS}>Бүх гал тогоо</SelectItem>
                  {diningHalls.map((hall) => (
                    <SelectItem key={hall.id} value={String(hall.id)}>
                      {hall.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Байгууллага, алба, хэлтэс хайх"
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Төлөвлөсөн" value={totals.expected} />
        <MetricCard label="Идсэн" value={totals.actual} />
        <MetricCard label="Нийт зөрүү" value={variance} signed />
        <MetricCard
          label="Үндсэн ажилтны зөрүү"
          value={regularVariance}
          signed
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Гэрээт зөрүү" value={contractVariance} signed />
        <MetricCard label="Гараар" value={totals.manual} />
        <MetricCard label="Нэмэлт порц" value={totals.extra} />
        <MetricCard label="Буруу байршил" value={totals.wrong} />
      </div>

      <Card>
        <CardHeader className="gap-3 md:flex md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>Сарын нэгтгэл</CardTitle>
            <CardDescription>
              {companyRows.length} байгууллага, {filteredSummary.length}{" "}
              дэлгэрэнгүй мөр{" "}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Нийт өдөр: {dates.length}</Badge>
            {dates[0] && dates[dates.length - 1] ? (
              <Badge variant="outline">
                {dates[0]} - {dates[dates.length - 1]}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Байгууллага</TableHead>
                  <TableHead>Ангилал</TableHead>
                  <TableHead className="text-right">Дэлгэрэнгүй</TableHead>
                  <TableHead className="text-right">Төлөвлөсөн</TableHead>
                  <TableHead className="text-right">Идсэн</TableHead>
                  <TableHead className="text-right">Зөрүү</TableHead>
                  <TableHead className="text-right">Гараар</TableHead>
                  <TableHead className="text-right">Нэмэлт</TableHead>
                  <TableHead className="text-right">Буруу</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-28 text-center text-muted-foreground">
                      Мэдээлэл олдсонгүй
                    </TableCell>
                  </TableRow>
                ) : (
                  companyRows.map((row) => {
                    const isExpanded = expandedCompanies.has(row.org_name);
                    const details = detailByCompany.get(row.org_name) || [];

                    return (
                      <Fragment key={row.org_name}>
                        <TableRow>
                          <TableCell className="min-w-[260px] font-medium">
                            <button
                              type="button"
                              onClick={() => toggleCompany(row.org_name)}
                              className="flex w-full items-center gap-2 text-left">
                              {isExpanded ? (
                                <ChevronDown className="text-muted-foreground" />
                              ) : (
                                <ChevronRight className="text-muted-foreground" />
                              )}
                              <span>{row.org_name}</span>
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.is_contract ? "secondary" : "outline"
                              }>
                              {row.is_contract ? "Гэрээт" : "Үндсэн"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(row.detail_count)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(row.expected_count)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(row.actual_count)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(
                              row.actual_count - row.expected_count,
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(row.manual_override_total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(row.extra_serving_total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(row.wrong_location_total)}
                          </TableCell>
                        </TableRow>
                        {isExpanded ? (
                          <TableRow>
                            <TableCell colSpan={9} className="bg-muted/30 p-0">
                              <CompanyDetailTable rows={details} />
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyDetailTable({ rows }: { rows: FoodMonthlyReportRow[] }) {
  return (
    <div className="overflow-x-auto p-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Гал тогоо</TableHead>
            <TableHead>Алба</TableHead>
            <TableHead>Хэлтэс</TableHead>
            <TableHead>Хоол</TableHead>
            <TableHead className="text-right">Төлөвлөсөн</TableHead>
            <TableHead className="text-right">Идсэн</TableHead>
            <TableHead className="text-right">Зөрүү</TableHead>
            <TableHead className="text-right">Гараар</TableHead>
            <TableHead className="text-right">Нэмэлт</TableHead>
            <TableHead className="text-right">Буруу</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={`${row.dining_hall_id}-${row.dep_name}-${row.heltes_name}-${row.meal_type}-${index}`}>
              <TableCell className="min-w-[180px]">
                {row.dining_hall_name || `Hall #${row.dining_hall_id}`}
              </TableCell>
              <TableCell className="min-w-[180px]">{row.dep_name}</TableCell>
              <TableCell className="min-w-[180px]">{row.heltes_name}</TableCell>
              <TableCell className="min-w-[140px]">
                {getMealLabel(row.meal_type)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(row.expected_count)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(row.actual_count)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(row.actual_count - row.expected_count)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(row.manual_override_total)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(row.extra_serving_total)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(row.wrong_location_total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MetricCard({
  label,
  value,
  signed = false,
}: {
  label: string;
  value: number;
  signed?: boolean;
}) {
  const displayValue =
    signed && value > 0 ? `+${formatNumber(value)}` : formatNumber(value);

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{displayValue}</CardTitle>
      </CardHeader>
    </Card>
  );
}
