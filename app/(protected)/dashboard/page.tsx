import { getPolicyOverview, getOrderStats, getMonthlyOrderTrend, getOrderStatusBreakdown } from "@/actions/dashboard";
import { hasPermission, hasRole } from "@/actions/rbac";
import { FileText, Star, BookOpen, BarChart3, TrendingUp, ClipboardList, Clock, CheckCircle2, XCircle } from "lucide-react";
import { OrderTrendChart } from "@/components/dashboard/order-trend-chart";
import { OrderStatusChart } from "@/components/dashboard/order-status-chart";

export default async function DashboardPage() {
  const hasPolicyAccess = await hasPermission("policy", "access");
  const hasOrderAccess = await hasRole(["hr_emp", "monitoring_emp", "super_admin", "order_system"]);

  const [policyOverview, orderStats, monthlyTrend, statusBreakdown] = await Promise.all([
    hasPolicyAccess ? getPolicyOverview() : Promise.resolve(null),
    hasOrderAccess  ? getOrderStats()     : Promise.resolve(null),
    hasOrderAccess  ? getMonthlyOrderTrend() : Promise.resolve([]),
    hasOrderAccess  ? getOrderStatusBreakdown() : Promise.resolve([]),
  ]);

  const today = new Date();
  const dateStr = `${today.getFullYear()} оны ${today.getMonth() + 1}-р сарын ${today.getDate()}`;

  const orderStatCards = orderStats ? [
    { label: "Нийт захиалга",    value: orderStats.total,                          icon: ClipboardList, color: "blue"    as const },
    { label: "Хянагдаж байна",   value: orderStats.inProgress + orderStats.pending, icon: Clock,         color: "amber"   as const },
    { label: "Батлагдсан",       value: orderStats.approved,                        icon: CheckCircle2,  color: "emerald" as const },
    { label: "Татгалзсан",       value: orderStats.rejected,                        icon: XCircle,       color: "red"     as const },
  ] : [];

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6">

      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            {dateStr}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Хяналтын самбар
          </h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Систем ажиллаж байна
        </div>
      </div>

      {/* Order stats — захиалгын эрх бүхий хүмүүст */}
      {hasOrderAccess && orderStats && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Захиалгын статистик</h2>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {orderStatCards.map(({ label, value, icon: Icon, color }) => (
              <StatCard key={label} title={label} value={value} icon={Icon} color={color} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OrderTrendChart data={monthlyTrend as any} />
            {(statusBreakdown as any[]).length > 0 && (
              <OrderStatusChart data={statusBreakdown as any} />
            )}
          </div>
        </section>
      )}

      {/* Policy stats */}
      {policyOverview ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Журамын ерөнхий мэдээлэл
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="Нийт журам"   value={policyOverview.totalPolicies} icon={FileText}  color="blue"   trend="+2 энэ сар" />
            <StatCard title="Нийт заалт"   value={policyOverview.totalClauses}  icon={BookOpen}  color="violet" />
            <StatCard title="Нийт үнэлгээ" value={policyOverview.totalRatings}  icon={BarChart3} color="cyan" />
            <StatCard title="Дундаж оноо"  value={policyOverview.averageScore}  icon={Star}      color="amber"  suffix="/ 5" />
          </div>
        </section>
      ) : !hasOrderAccess ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-24 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <BarChart3 className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground">Статистик харах эрх байхгүй</p>
          <p className="mt-1 text-sm text-muted-foreground">Системийн администратортой холбогдоно уу</p>
        </div>
      ) : null}
    </div>
  );
}

const colorMap = {
  blue:    { bg: "bg-blue-50",    icon: "text-blue-500",    ring: "ring-blue-100",    bar: "bg-blue-500" },
  violet:  { bg: "bg-violet-50",  icon: "text-violet-500",  ring: "ring-violet-100",  bar: "bg-violet-500" },
  cyan:    { bg: "bg-cyan-50",    icon: "text-cyan-500",    ring: "ring-cyan-100",    bar: "bg-cyan-500" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-500",   ring: "ring-amber-100",   bar: "bg-amber-500" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", ring: "ring-emerald-100", bar: "bg-emerald-500" },
  red:     { bg: "bg-red-50",     icon: "text-red-500",     ring: "ring-red-100",     bar: "bg-red-500" },
};

function StatCard({
  title, value, icon: Icon, color, suffix, trend,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: keyof typeof colorMap;
  suffix?: string;
  trend?: string;
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
          {suffix && <span className="ml-1 text-base font-normal text-muted-foreground">{suffix}</span>}
        </p>
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
            <TrendingUp className="h-3 w-3" />
            <span>{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
}
