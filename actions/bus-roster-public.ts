"use server";

// Session шаардлагагүй, нээлттэй "автобусанд хуваарилагдсан зорчигчид" харах
// public хуудасны өгөгдлийг public.bus_roster_public view-ээс уншина. Энэ view
// зөвхөн нэр/автобус/ээлжийн мэдээлэл агуулна (утас, регистрийн дугаар г.м.
// PII огт байхгүй) бөгөөд anon рольд шууд SELECT олгогдсон тул нэвтрэлгүй ч
// уншиж болно.
import { createClient } from "@/utils/supabase/server";
import type { ShiftDirection } from "@/types/shift-exchange";

export interface PublicRosterRow {
  exchangeId: number;
  exchangeName: string;
  exchangeDate: string;
  exchangeDirection: ShiftDirection;
  busId: number;
  busName: string;
  departureTime: string | null;
  lastName: string | null;
  firstName: string | null;
  passengerName: string;
  positionName: string | null;
  // Алба байвал алба, байхгүй бол хэлтэс — assignment-board.tsx-тэй ижил дүрэм.
  albaOrHeltes: string | null;
  organizationName: string | null;
  isConfirmed: boolean;
}

export async function getPublicBusRoster(): Promise<PublicRosterRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bus_roster_public")
    .select("*")
    .order("exchange_date", { ascending: false })
    .order("bus_name")
    .order("passenger_name");
  if (error) {
    console.error("[bus-roster-public] getPublicBusRoster:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    exchangeId: Number(r.exchange_id),
    exchangeName: r.exchange_name as string,
    exchangeDate: r.exchange_date as string,
    exchangeDirection: r.exchange_direction as ShiftDirection,
    busId: Number(r.bus_id),
    busName: r.bus_name as string,
    departureTime: (r.departure_time as string) ?? null,
    lastName: (r.last_name as string) ?? null,
    firstName: (r.first_name as string) ?? null,
    passengerName: r.passenger_name as string,
    positionName: (r.position_name as string) ?? null,
    albaOrHeltes: ((r.alba_name as string) || (r.heltes_name as string)) ?? null,
    organizationName: (r.organization_name as string)?.trim() || null,
    isConfirmed: Boolean(r.is_confirmed),
  }));
}
