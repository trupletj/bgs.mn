import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatDuration,
  formatTime,
  getDayName,
  isToday,
} from "@/lib/format-attendance";
import type { AttendanceDay } from "@/types/attendance";

function TimeCell({
  label,
  time,
  color,
  Icon,
}: {
  label: string;
  time: string | null;
  color: string;
  Icon: typeof Clock;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-sm font-bold tabular-nums text-foreground">
        {time ?? "—"}
      </span>
    </div>
  );
}

export function AttendanceDayCard({ day }: { day: AttendanceDay }) {
  const today = isToday(day.dayDate);
  return (
    <Card
      className={cn(
        "gap-3 px-4 py-3",
        today && "border-primary ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">
            {formatDate(day.dayDate)}
          </span>
          <span className="text-sm text-muted-foreground">
            {getDayName(day.dayDate)}
          </span>
          {today && <Badge>Өнөөдөр</Badge>}
        </div>
        <div className="flex items-center gap-1.5">
          {day.isHotsorson && (
            <Badge className="border-transparent bg-amber-100 text-amber-700">
              Хоцорсон
            </Badge>
          )}
          {day.isErtTarsan && (
            <Badge variant="destructive">Эрт тарсан</Badge>
          )}
        </div>
      </div>

      <div className="flex rounded-xl bg-muted/60 py-3">
        <TimeCell
          label="Ирэх цаг"
          time={formatTime(day.startAt)}
          color="#6366F1"
          Icon={Clock}
        />
        <TimeCell
          label="Ирсэн цаг"
          time={formatTime(day.workStartAt)}
          color="#22C55E"
          Icon={LogIn}
        />
        <TimeCell
          label="Явсан цаг"
          time={formatTime(day.workEndAt)}
          color="#EF4444"
          Icon={LogOut}
        />
        <TimeCell
          label="Явах цаг"
          time={formatTime(day.endAt)}
          color="#6366F1"
          Icon={Clock}
        />
      </div>

      {day.workDuration != null && (
        <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Ажилласан цаг: {formatDuration(day.workDuration)}</span>
        </div>
      )}
    </Card>
  );
}
