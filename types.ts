export interface OrderItemForm {
  part_number?: string;
  part_name: string;
  part_description?: string;
  manufacturer?: string;
  quantity: number;
  notes?: string;
  image_url?: string;
  unit?: string;
}

export interface OrderFormData {
  title: string;
  description: string;
  order_type: string;
  // equipment_name: string;
  // equipment_model: string;
  // equipment_serial: string;
  // equipment_location: string;
  urgency_level: "low" | "medium" | "high" | "critical";
  requested_delivery_date: string;
  notes: string;
}

export const UNIT_OPTIONS = [
  { value: "piece", label: "Ширхэг", type: "count" },
  { value: "meter", label: "Метр (м)", type: "length" },
  { value: "square_meter", label: "Квадрат метр (м²)", type: "area" },
  { value: "cubic_meter", label: "Куб метр (м³)", type: "volume" },
  { value: "kilogram", label: "Килограмм (кг)", type: "weight" },
  { value: "gram", label: "Грам (г)", type: "weight" },
  { value: "liter", label: "Литр (л)", type: "volume" },
  { value: "set", label: "Баглаа/Сэт", type: "count" },
  { value: "package", label: "Багц", type: "count" },
  { value: "roll", label: "Ороомог", type: "count" },
] as const;

export type UnitOption = (typeof UNIT_OPTIONS)[number];
