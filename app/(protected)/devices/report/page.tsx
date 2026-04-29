import { getDeviceReportByDepartment } from "@/actions/devices";
import { hasRole } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import { Badge } from "@/components/ui/badge";
import { DEVICE_TYPE_CONFIG, DEVICE_STATUS_CONFIG, type DeviceType, type DeviceStatus } from "@/types/device";
import { BarChart3, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function DeviceReportPage() {
  const canAccess = await hasRole(["super_admin", "it_engineer"]);
  if (!canAccess) return <UnauthorizedPage />;

  const { data: devices } = await getDeviceReportByDepartment();

  // Group by organization + alba (prefer FK names, fallback to text)
  const groupMap = new Map<string, { org: string | null; dept: string; heltes: string | null; items: any[] }>();

  for (const d of devices) {
    const orgName  = (d as any).organization?.name ?? null;
    const albaName = (d as any).alba?.name ?? d.department_name ?? "Тодорхойгүй";
    const heltesName = (d as any).heltes?.name ?? d.heltes_name ?? null;
    const key = `${orgName ?? ""}||${heltesName ?? ""}||${albaName}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { org: orgName, dept: albaName, heltes: heltesName, items: [] });
    }
    groupMap.get(key)!.items.push(d);
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => b.items.length - a.items.length);


  const totalByType = Object.keys(DEVICE_TYPE_CONFIG).reduce((acc, t) => {
    acc[t] = devices.filter((d) => d.device_type === t).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">IT Модуль</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Тайлан</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Алба хэлтсийн ашиглаж байгаа тоног төхөөрөмжийн нэгтгэл</p>
      </div>

      {/* By type summary */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Төрлөөр нэгтгэсэн</h2>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(DEVICE_TYPE_CONFIG).map(([type, cfg]) => {
            const count = totalByType[type] ?? 0;
            if (count === 0) return null;
            return (
              <div key={type} className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{count}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{cfg.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* By department */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Алба, хэлтсээр нэгтгэсэн</h2>
          <div className="h-px flex-1 bg-border" />
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {groups.length} алба/хэлтэс
          </span>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
            <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Өгөгдөл байхгүй</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((g) => {
              const typeCount = Object.keys(DEVICE_TYPE_CONFIG).reduce((acc, t) => {
                const c = g.items.filter((i) => i.device_type === t).length;
                if (c > 0) acc[t] = c;
                return acc;
              }, {} as Record<string, number>);

              const statusCount = Object.keys(DEVICE_STATUS_CONFIG).reduce((acc, s) => {
                const c = g.items.filter((i) => i.status === s).length;
                if (c > 0) acc[s] = c;
                return acc;
              }, {} as Record<string, number>);

              return (
                <div key={`${g.dept}${g.heltes}`} className="rounded-xl border border-border bg-card overflow-hidden">
                  {/* Section header */}
                  <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        {g.org && <p className="text-xs text-muted-foreground">{g.org}</p>}
                        <span className="font-semibold text-sm">{g.dept}</span>
                        {g.heltes && <span className="text-sm text-muted-foreground"> · {g.heltes}</span>}
                      </div>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      Нийт: {g.items.length}
                    </span>
                  </div>

                  <div className="px-5 py-3 flex flex-col gap-3">
                    {/* By type */}
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(typeCount).map(([t, c]) => (
                        <div key={t} className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs">
                          <span className="font-semibold tabular-nums">{c}</span>
                          <span className="text-muted-foreground">{DEVICE_TYPE_CONFIG[t as DeviceType]?.label ?? t}</span>
                        </div>
                      ))}
                    </div>

                    {/* By status */}
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(statusCount).map(([s, c]) => {
                        const cfg = DEVICE_STATUS_CONFIG[s as DeviceStatus];
                        return (
                          <Badge key={s} variant="outline" className={cn("text-xs gap-1", cfg?.className)}>
                            <span className="font-bold">{c}</span>
                            {cfg?.label ?? s}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
