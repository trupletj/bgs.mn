"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 24 цагийн огноо/цаг сонгогч (AM/PM-гүй). Native datetime-local нь хөтчийн
 * locale-аас шалтгаалж AM/PM харуулдаг тул огноог `type=date`, цагийг 24 цагийн
 * select-ээр салгав. `value`/`onChange` нь datetime-local-тай ижил
 * "YYYY-MM-DDTHH:mm" форматтай.
 */
const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

export function DateTime24({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const date = value.slice(0, 10);
  const hour = value.slice(11, 13) || "";
  const minute = value.slice(14, 16) || "";

  const emit = (d: string, h: string, m: string) => {
    if (!d) {
      onChange("");
      return;
    }
    onChange(`${d}T${h || "00"}:${m || "00"}`);
  };

  return (
    <div className={"flex flex-wrap items-center gap-2 " + (className ?? "")}>
      <Input
        type="date"
        value={date}
        onChange={(e) => emit(e.target.value, hour, minute)}
        className="w-40"
      />
      <div className="flex items-center gap-1">
        <Select
          value={hour || undefined}
          onValueChange={(h) => emit(date, h, minute || "00")}>
          <SelectTrigger className="w-[4.5rem]">
            <SelectValue placeholder="ЦЦ" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {HOURS.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">:</span>
        <Select
          value={minute || undefined}
          onValueChange={(m) => emit(date, hour || "00", m)}>
          <SelectTrigger className="w-[4.5rem]">
            <SelectValue placeholder="ММ" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {MINUTES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
