import { CheckCircle2, Clock, FileText, TrendingUp } from "lucide-react";
import type { PolicyDashboardSummary } from "@/lib/policy-utils";

const colorMap = {
  blue: { bg: "bg-blue-50", icon: "text-blue-500", ring: "ring-blue-100", bar: "bg-blue-500" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", ring: "ring-emerald-100", bar: "bg-emerald-500" },
  amber: { bg: "bg-amber-50", icon: "text-amber-500", ring: "ring-amber-100", bar: "bg-amber-500" },
  violet: { bg: "bg-violet-50", icon: "text-violet-500", ring: "ring-violet-100", bar: "bg-violet-500" },
} as const;

type Color = keyof typeof colorMap;

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  suffix,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: Color;
  suffix?: string;
}) {
  const c = colorMap[color];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className={`absolute left-0 top-0 h-0.5 w-full ${c.bar} opacity-60`} />
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className={`rounded-lg p-2 ${c.bg} ring-1 ${c.ring}`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
          {value}
          {suffix && (
            <span className="ml-1 text-base font-normal text-muted-foreground">
              {suffix}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export function PolicyStatCards({
  summary,
}: {
  summary: PolicyDashboardSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard title="Нийт журам" value={summary.total} icon={FileText} color="blue" />
      <StatCard title="Үнэлсэн" value={summary.ratedCount} icon={CheckCircle2} color="emerald" />
      <StatCard title="Хүлээлтэнд" value={summary.unratedCount} icon={Clock} color="amber" />
      <StatCard title="Дундаж хэрэгжилт" value={summary.avgPercent} suffix="%" icon={TrendingUp} color="violet" />
    </div>
  );
}
