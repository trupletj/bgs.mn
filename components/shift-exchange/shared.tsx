import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  ShiftDirection,
  ShiftExchangeStatus,
} from "@/types/shift-exchange";

/**
 * `localeCompare` (ялангуяа "mn" locale-той) нь Intl/ICU-с хамаардаг тул server
 * (Node) болон client (browser)-д өөр эрэмбэ гаргаж болзошгүй — "use client"
 * component дотор SSR/hydration хооронд эрэмбэ зөрвөл React hydration mismatch
 * шидэнэ (жагсаалт эрэмбэ солигдож "дахин зурагдана"). Тиймээс жагсаалтын
 * эрэмбэ DOM бүтцэд нөлөөлдөг газарт Intl огт ашиглахгүй, ердийн Unicode
 * codepoint-оор харьцуулна — аль ч орчинд яг ижил үр дүн гарна.
 */
export function mnCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** mnCompare шиг боловч тоон хэсгүүдийг ("Автобус 2" vs "Автобус 10") бодит
 *  тоогоор нь харьцуулна ("numeric: true"-ийн Intl-гүй хувилбар). */
export function mnCompareNatural(a: string, b: string): number {
  const chunks = /(\d+)|(\D+)/g;
  const A = a.match(chunks) ?? [];
  const B = b.match(chunks) ?? [];
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const x = A[i] ?? "";
    const y = B[i] ?? "";
    if (x === y) continue;
    const isNumeric = (s: string) => /^\d+$/.test(s);
    if (isNumeric(x) && isNumeric(y)) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff;
    } else {
      return mnCompare(x, y);
    }
  }
  return 0;
}

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
 * "(ООО/)ММ/ӨӨ, ЦЦ:мм" хэлбэрээр Улаанбаатарын цагаар (UTC+8, DST-гүй)
 * форматална. `toLocaleString("mn-MN", ...)` server (Node ICU)-той
 * client (browser)-ийн хооронд өөр гарч ирж (жишээ нь сарыг "VII" гэх мэт
 * роман тоогоор) hydration mismatch үүсгэдэг тул Intl огт ашиглахгүйгээр
 * гараар форматална.
 */
export function formatBusDateTime(
  iso: string,
  { includeYear = false }: { includeYear?: boolean } = {},
): string {
  const d = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = includeYear
    ? `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`
    : `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
  return `${ymd}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
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
