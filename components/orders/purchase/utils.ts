import { UNIT_OPTIONS } from "@/types/types";

export const PURCHASE_MOVEMENT_LABELS: Record<string, string> = {
  purchased: "Худалдан авсан",
  at_warehouse: "Агуулахад ирсэн",
  in_delivery: "Хүргэлтэд гарсан",
  at_mine: "Уурхайд очсон",
  completed: "Хэрэгжиж дууссан",
  cancelled: "Цуцлагдсан",
};

export const NEXT_FULFILLMENT_STATUS_OPTIONS: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  purchased: [
    { value: "at_warehouse", label: "Агуулахад ирсэн" },
    { value: "in_delivery", label: "Хүргэлтэд гарсан" },
    { value: "at_mine", label: "Уурхайд очсон" },
    { value: "completed", label: "Хэрэгжиж дууссан" },
    { value: "cancelled", label: "Цуцлагдсан" },
  ],
  at_warehouse: [
    { value: "purchased", label: "Худалдан авсан" },
    { value: "in_delivery", label: "Хүргэлтэд гарсан" },
    { value: "at_mine", label: "Уурхайд очсон" },
    { value: "completed", label: "Хэрэгжиж дууссан" },
    { value: "cancelled", label: "Цуцлагдсан" },
  ],
  in_delivery: [
    { value: "purchased", label: "Худалдан авсан" },
    { value: "at_warehouse", label: "Агуулахад ирсэн" },
    { value: "at_mine", label: "Уурхайд очсон" },
    { value: "completed", label: "Хэрэгжиж дууссан" },
    { value: "cancelled", label: "Цуцлагдсан" },
  ],
  at_mine: [
    { value: "purchased", label: "Худалдан авсан" },
    { value: "at_warehouse", label: "Агуулахад ирсэн" },
    { value: "in_delivery", label: "Хүргэлтэд гарсан" },
    { value: "completed", label: "Хэрэгжиж дууссан" },
    { value: "cancelled", label: "Цуцлагдсан" },
  ],
  completed: [
    { value: "purchased", label: "Худалдан авсан" },
    { value: "at_warehouse", label: "Агуулахад ирсэн" },
    { value: "in_delivery", label: "Хүргэлтэд гарсан" },
    { value: "at_mine", label: "Уурхайд очсон" },
    { value: "cancelled", label: "Цуцлагдсан" },
  ],
  cancelled: [
    { value: "purchased", label: "Худалдан авсан" },
    { value: "at_warehouse", label: "Агуулахад ирсэн" },
    { value: "in_delivery", label: "Хүргэлтэд гарсан" },
    { value: "at_mine", label: "Уурхайд очсон" },
    { value: "completed", label: "Хэрэгжиж дууссан" },
  ],
};

export const CURRENCY_OPTIONS = [
  { value: "MNT", label: "Төгрөг (MNT)" },
  { value: "USD", label: "Доллар (USD)" },
  { value: "CNY", label: "Юань (CNY)" },
  { value: "RUB", label: "Рубль (RUB)" },
  { value: "EUR", label: "Евро (EUR)" },
];


export function getUnitLabel(value: string) {
  return UNIT_OPTIONS.find((o) => o.value === value)?.label ?? value ?? "ш";
}

export function formatDate(dateString?: string | null) {
  if (!dateString) return "—";
  const dateOnly = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) return `${dateOnly[1]}.${dateOnly[2]}.${dateOnly[3]}`;

  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function formatQuantity(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("mn-MN");
}

export function formatMoney(value?: number | string | null, currency = "MNT") {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toLocaleString("mn-MN")} ${currency}`;
}
