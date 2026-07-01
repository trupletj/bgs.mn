import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  ShiftDirection,
  ShiftExchangeStatus,
} from "@/types/shift-exchange";

export const DIRECTION_LABEL: Record<ShiftDirection, string> = {
  arriving: "Ирэх",
  departing: "Буух",
};

export const STATUS_LABEL: Record<ShiftExchangeStatus, string> = {
  draft: "Ноорог",
  published: "Нийтэлсэн",
  completed: "Дууссан",
  cancelled: "Цуцалсан",
};

const STATUS_CLASS: Record<ShiftExchangeStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-transparent",
  published: "bg-emerald-100 text-emerald-700 border-transparent",
  completed: "bg-indigo-100 text-indigo-700 border-transparent",
  cancelled: "bg-rose-100 text-rose-700 border-transparent",
};

export function StatusBadge({ status }: { status: ShiftExchangeStatus }) {
  return <Badge className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Бүртгэлийн анхдагч эцсийн огноо = exchange_date - 2 өдөр ('YYYY-MM-DD'). */
export function registrationDeadline(exchangeDate: string): string {
  const d = new Date(`${exchangeDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 2);
  return d.toISOString().slice(0, 10);
}

/** Гадаад компанийн төлөөлөгч одоо бүртгэж/устгаж болох эсэх (UI-д). */
export function repRegistrationOpen(e: {
  status: ShiftExchangeStatus;
  openForRegistration: boolean;
  exchangeDate: string;
  registrationOverrideUntil: string | null;
}): boolean {
  if (e.status !== "published" || !e.openForRegistration) return false;
  if (e.registrationOverrideUntil)
    return Date.now() <= new Date(e.registrationOverrideUntil).getTime();
  const todayUtc = new Date().toISOString().slice(0, 10);
  return todayUtc <= registrationDeadline(e.exchangeDate);
}

/** UTC+8-ийн 7 хоногийн 5 дахь өдөр = Баасан гараг (ISO weekday 5). */
export function isFridayDate(dateStr: string): boolean {
  // dateStr нь 'YYYY-MM-DD' — tz-аас хамаарахгүйгээр UTC-ээр гариг тооцно.
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay() === 5;
}

/**
 * Зорчигчийн дээд хязгаар — автобусны нийт суудлаас аялалын ахлахын 1 суудлыг
 * нөөцөлнө (ахлахтай нийлээд нийт capacity хүн сууна).
 */
export function passengerCapacity(capacity: number): number {
  return Math.max(capacity - 1, 0);
}

/** Аялалын ахлах оноогдоогүй автобусыг анхааруулах улаан badge. */
export function NoLeaderBadge() {
  return (
    <Badge className="gap-1 border-transparent bg-rose-100 text-rose-700">
      <AlertTriangle className="h-3 w-3" />
      Ахлахгүй
    </Badge>
  );
}

export function DirectionBadge({ direction }: { direction: ShiftDirection }) {
  return (
    <Badge
      className={
        direction === "arriving"
          ? "bg-sky-100 text-sky-700 border-transparent"
          : "bg-amber-100 text-amber-700 border-transparent"
      }>
      {DIRECTION_LABEL[direction]}
    </Badge>
  );
}
