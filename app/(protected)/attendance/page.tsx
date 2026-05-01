import { AlertTriangle } from "lucide-react";
import { getMyAttendance14d } from "@/actions/attendance";
import { AttendanceDayCard } from "@/components/dashboard/attendance-day-card";

export default async function AttendancePage() {
  const days = await getMyAttendance14d();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Сүүлийн 14 хоног
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Ирц
        </h1>
      </div>

      {days.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">
            Цаг бүртгэлийн мэдээлэл байхгүй
          </p>
          <p className="text-sm text-muted-foreground">
            Утасны дугаар нь intranet системд бүртгэлгүй эсвэл бүртгэл хоосон
            байна
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((day) => (
            <AttendanceDayCard key={day.dayDate} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}
