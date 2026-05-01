import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  LogIn,
  LogOut,
} from "lucide-react";
import { getMyAttendance14d } from "@/actions/attendance";
import {
  formatDuration,
  formatTime,
  getDayName,
  isToday,
} from "@/lib/format-attendance";
import { cn } from "@/lib/utils";
import type { AttendanceDay } from "@/types/attendance";

function TodayRow({ day }: { day: AttendanceDay }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field
        Icon={Clock}
        label="Ирэх"
        value={formatTime(day.startAt) ?? "—"}
        accent="text-indigo-500"
      />
      <Field
        Icon={LogIn}
        label="Ирсэн"
        value={formatTime(day.workStartAt) ?? "—"}
        accent="text-emerald-500"
      />
      <Field
        Icon={LogOut}
        label="Явсан"
        value={formatTime(day.workEndAt) ?? "—"}
        accent="text-rose-500"
      />
      <Field
        Icon={Clock}
        label="Явах"
        value={formatTime(day.endAt) ?? "—"}
        accent="text-indigo-500"
      />
    </div>
  );
}

function Field({
  Icon,
  label,
  value,
  accent,
}: {
  Icon: typeof Clock;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted/60 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", accent)} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <span className="text-base font-bold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

function StatusGlyph({ day }: { day: AttendanceDay }) {
  if (day.workStartAt == null && day.workEndAt == null) {
    return <span className="text-muted-foreground/40">·</span>;
  }
  if (day.isHotsorson || day.isErtTarsan) {
    return <span className="text-amber-500">▒</span>;
  }
  return <span className="text-emerald-500">█</span>;
}

function WeekStrip({ days }: { days: AttendanceDay[] }) {
  const last7 = [...days]
    .filter((d) => !isToday(d.dayDate))
    .slice(0, 7)
    .reverse();
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Өнгөрсөн 7 хоног
      </span>
      <div className="flex items-center gap-3 font-mono text-sm">
        {last7.map((d) => (
          <div key={d.dayDate} className="flex flex-col items-center gap-0.5">
            <StatusGlyph day={d} />
            <span className="text-[9px] text-muted-foreground">
              {getDayName(d.dayDate)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function AttendanceWidget() {
  const days = await getMyAttendance14d();
  const today = days.find((d) => isToday(d.dayDate));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Ирц</h2>
        <Link
          href="/attendance"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Бүгдийг харах
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        {days.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertTriangle className="h-7 w-7 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Цаг бүртгэлийн мэдээлэл байхгүй
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              Хэрэглэгч intranet-тэй холбогдоогүй эсвэл бүртгэл одоохондоо
              хоосон байна
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {today ? (
              <>
                <TodayRow day={today} />
                {today.workDuration != null && (
                  <p className="text-right text-xs text-muted-foreground">
                    Ажилласан цаг:{" "}
                    <span className="font-semibold text-foreground">
                      {formatDuration(today.workDuration)}
                    </span>
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Өнөөдрийн бүртгэл хараахан үүсээгүй
              </p>
            )}
            <WeekStrip days={days} />
          </div>
        )}
      </div>
    </section>
  );
}
