"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createClient, createClientForSchema } from "@/utils/supabase/server";
import { hasPermission } from "@/actions/rbac";
import type { UserSearchResult } from "@/actions/users";
import type {
  ActionResult,
  AutoDistributeResult,
  AutobusDirection,
  Bus,
  BulkAssignResult,
  BulkByOrgResult,
  BusWithStats,
  CompanionGroup,
  CompanionGroupMember,
  EeljGroupOption,
  LinkedGroup,
  Organization,
  PassengerAssignment,
  ShiftDirection,
  ShiftExchange,
  ShiftExchangeStatus,
  ShiftExchangeWithStats,
  SubmitPoolResult,
} from "@/types/shift-exchange";

const SCHEMA = "bgs_attendance";
const sb = () => createClientForSchema(SCHEMA);

async function requireAdmin(): Promise<string | null> {
  const ok = await hasPermission("shift_exchange", "view");
  return ok ? null : "Танд энэ үйлдлийг хийх эрх алга";
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_user_id");
  return (data as string) ?? null;
}

// ── Mappers ────────────────────────────────────────────────────────────────
const r = (row: unknown) => row as Record<string, unknown>;

function mapExchange(row: unknown): ShiftExchange {
  const x = r(row);
  return {
    id: Number(x.id),
    name: String(x.name ?? ""),
    exchangeDate: String(x.exchange_date),
    direction: x.direction as ShiftDirection,
    status: x.status as ShiftExchangeStatus,
    openForRegistration: Boolean(x.open_for_registration),
    registrationOverrideUntil:
      (x.registration_override_until as string) ?? null,
    notes: (x.notes as string) ?? null,
    createdBy: (x.created_by as string) ?? null,
    publishedAt: (x.published_at as string) ?? null,
    createdAt: (x.created_at as string) ?? null,
    updatedAt: (x.updated_at as string) ?? null,
  };
}

// ── Directions / eelj groups (public schema) ───────────────────────────────
export const getDirections = cache(async (): Promise<AutobusDirection[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("autobus_direction")
    .select("id, bteg_id, name, zam_tsag")
    .order("name", { nullsFirst: false });
  if (error) {
    console.error("[shift-exchange] getDirections:", error.message);
    return [];
  }
  return (data ?? []).map((d) => ({
    id: String(d.id),
    btegId: String(d.bteg_id),
    name: (d.name as string) ?? null,
    zamTsag: d.zam_tsag != null ? Number(d.zam_tsag) : null,
  }));
});

export const getEeljGroups = cache(async (): Promise<EeljGroupOption[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eelj_groups")
    .select("bteg_id, name")
    .order("name", { nullsFirst: false });
  if (error) {
    console.error("[shift-exchange] getEeljGroups:", error.message);
    return [];
  }
  return (data ?? [])
    .filter((g) => g.bteg_id)
    .map((g) => ({
      btegId: String(g.bteg_id),
      name: (g.name as string) ?? "",
    }));
});

// ── Companion groups (хамтрагч бүлэг) ────────────────────────────────────────
export const getCompanionGroups = cache(async (): Promise<CompanionGroup[]> => {
  const client = await sb();
  const { data: groups } = await client
    .from("companion_groups")
    .select("id, name")
    .order("name", { nullsFirst: false });
  if (!groups?.length) return [];

  const groupIds = groups.map((g) => Number(g.id));
  const { data: members } = await client
    .from("companion_group_members")
    .select("id, group_id, internal_user_id")
    .in("group_id", groupIds)
    .order("id");

  const userIds = [
    ...new Set((members ?? []).map((m) => String(m.internal_user_id))),
  ];
  const userMap = new Map<string, Record<string, unknown>>();
  if (userIds.length) {
    const supabase = await createClient();
    const { data: users } = await supabase
      .from("users")
      .select(
        "id, first_name, last_name, position_name, department_name, phone",
      )
      .in("id", userIds);
    for (const u of users ?? []) userMap.set(String(u.id), u);
  }

  const byGroup = new Map<number, CompanionGroupMember[]>();
  for (const m of members ?? []) {
    const u = userMap.get(String(m.internal_user_id));
    const arr = byGroup.get(Number(m.group_id)) ?? [];
    arr.push({
      memberId: Number(m.id),
      userId: String(m.internal_user_id),
      displayName:
        `${u?.last_name ?? ""} ${u?.first_name ?? ""}`.trim() || "Нэргүй",
      positionName: (u?.position_name as string) ?? null,
      albaName: (u?.department_name as string) ?? null,
      phone: (u?.phone as string) ?? null,
    });
    byGroup.set(Number(m.group_id), arr);
  }

  return groups.map((g) => ({
    id: Number(g.id),
    name: String(g.name ?? ""),
    members: byGroup.get(Number(g.id)) ?? [],
  }));
});

export async function createCompanionGroup(
  name: string,
): Promise<ActionResult<{ id: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  if (!name.trim()) return { ok: false, error: "Нэр шаардлагатай" };
  const createdBy = await currentUserId();
  const { data, error } = await (await sb())
    .from("companion_groups")
    .insert({ name: name.trim(), created_by: createdBy })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shift-exchange/companion-groups");
  return { ok: true, id: Number(data.id) };
}

export async function deleteCompanionGroup(id: number): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await (await sb())
    .from("companion_groups")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shift-exchange/companion-groups");
  return { ok: true };
}

export async function addCompanionMembers(
  groupId: number,
  userIds: string[],
): Promise<ActionResult<{ added: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  if (userIds.length === 0) return { ok: true, added: 0 };
  // нэг хүн нэг бүлэгт (unique internal_user_id) — өөр бүлэгт байгааг алгасна.
  const { data, error } = await (
    await sb()
  )
    .from("companion_group_members")
    .upsert(
      userIds.map((uid) => ({ group_id: groupId, internal_user_id: uid })),
      { onConflict: "internal_user_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shift-exchange/companion-groups");
  return { ok: true, added: data?.length ?? 0 };
}

export async function removeCompanionMember(
  memberId: number,
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await (await sb())
    .from("companion_group_members")
    .delete()
    .eq("id", memberId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shift-exchange/companion-groups");
  return { ok: true };
}

/** Гишүүнгүй болсон companion бүлгүүдийг устгана. */
async function cleanupEmptyCompanionGroups(
  client: Awaited<ReturnType<typeof sb>>,
): Promise<void> {
  const [{ data: all }, { data: used }] = await Promise.all([
    client.from("companion_groups").select("id"),
    client.from("companion_group_members").select("group_id"),
  ]);
  const usedSet = new Set((used ?? []).map((x) => Number(x.group_id)));
  const empties = (all ?? [])
    .map((x) => Number(x.id))
    .filter((id) => !usedSet.has(id));
  if (empties.length)
    await client.from("companion_groups").delete().in("id", empties);
}

async function assignmentsToUserIds(
  client: Awaited<ReturnType<typeof sb>>,
  assignmentIds: number[],
): Promise<string[]> {
  const { data } = await client
    .from("passenger_assignments")
    .select("internal_user_id")
    .in("id", assignmentIds);
  return [
    ...new Set(
      (data ?? []).map((r) => String(r.internal_user_id)).filter(Boolean),
    ),
  ];
}

/** Сонгосон зорчигчдыг (хуваарилалтаас) шууд нэг companion бүлэг болгож холбоно. */
export async function linkAssignmentsAsCompanions(
  assignmentIds: number[],
  name: string,
  exchangeId: number,
  busId: number,
): Promise<ActionResult<{ groupId: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const client = await sb();
  const userIds = await assignmentsToUserIds(client, assignmentIds);
  if (userIds.length < 2)
    return { ok: false, error: "Дор хаяж 2 хүн сонгоно уу" };

  const createdBy = await currentUserId();
  const { data: g, error: ge } = await client
    .from("companion_groups")
    .insert({ name: name.trim() || "Хамтрагч бүлэг", created_by: createdBy })
    .select("id")
    .single();
  if (ge) return { ok: false, error: ge.message };
  const gid = Number(g.id);

  // onConflict update → өмнө өөр бүлэгт байсан хүнийг шинэ бүлэгт шилжүүлнэ.
  const { error: me } = await client
    .from("companion_group_members")
    .upsert(
      userIds.map((uid) => ({ group_id: gid, internal_user_id: uid })),
      { onConflict: "internal_user_id" },
    );
  if (me) return { ok: false, error: me.message };

  await cleanupEmptyCompanionGroups(client);
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${busId}`);
  revalidatePath(`/shift-exchange/${exchangeId}`);
  revalidatePath("/shift-exchange/companion-groups");
  return { ok: true, groupId: gid };
}

/** Сонгосон зорчигчдыг companion бүлгээс салгана. */
export async function unlinkAssignmentsFromCompanions(
  assignmentIds: number[],
  exchangeId: number,
  busId: number,
): Promise<ActionResult<{ count: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const client = await sb();
  const userIds = await assignmentsToUserIds(client, assignmentIds);
  if (userIds.length === 0) return { ok: true, count: 0 };
  const { data, error } = await client
    .from("companion_group_members")
    .delete()
    .in("internal_user_id", userIds)
    .select("id");
  if (error) return { ok: false, error: error.message };
  await cleanupEmptyCompanionGroups(client);
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${busId}`);
  revalidatePath(`/shift-exchange/${exchangeId}`);
  revalidatePath("/shift-exchange/companion-groups");
  return { ok: true, count: data?.length ?? 0 };
}

export const getOrganizations = cache(async (): Promise<Organization[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization")
    .select("bteg_id, name, is_active")
    .order("name", { nullsFirst: false });
  if (error) {
    console.error("[shift-exchange] getOrganizations:", error.message);
    return [];
  }
  return (data ?? [])
    .filter((o) => o.bteg_id)
    .map((o) => ({
      btegId: String(o.bteg_id),
      name: (o.name as string) ?? "",
    }));
});

// org bteg_id → name map (cached)
const getOrgNameMap = cache(async (): Promise<Map<string, string>> => {
  const orgs = await getOrganizations();
  return new Map(orgs.map((o) => [o.btegId, o.name]));
});

const ORG_SEARCH_FIELDS = [
  "first_name",
  "last_name",
  "nice_name",
  "position_name",
  "phone",
  "register_number",
  "department_name",
  "heltes_name",
] as const;

/** All active users in the CURRENT user's organization, for browsing by
 *  alba/heltes (no search query). Ordered so callers can group on the client. */
export async function getMyOrgUsers(): Promise<UserSearchResult[]> {
  const supabase = await createClient();
  const { data: org } = await supabase.rpc("current_user_org_id");
  if (!org) return [];

  const { data, error } = await supabase
    .from("users")
    .select(
      "id, bteg_id, first_name, last_name, nice_name, position_name, department_name, heltes_name, phone, register_number",
    )
    .eq("is_active", true)
    .eq("organization_id", org as string)
    .order("department_name", { nullsFirst: false })
    .order("heltes_name", { nullsFirst: false })
    .order("last_name", { nullsFirst: false });

  if (error) {
    console.error("[shift-exchange] getMyOrgUsers:", error.message);
    return [];
  }
  return (data ?? []) as UserSearchResult[];
}

/** Search users in the CURRENT user's organization only (for company reps). */
export async function searchMyOrgUsers(
  query: string,
  limit = 12,
): Promise<UserSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (!parts.length) return [];

  const supabase = await createClient();
  const { data: org } = await supabase.rpc("current_user_org_id");
  if (!org) return [];

  const orConditions: string[] = [];
  for (const part of parts) {
    const safe = part.replace(/[%,]/g, "");
    for (const field of ORG_SEARCH_FIELDS)
      orConditions.push(`${field}.ilike.%${safe}%`);
  }

  const { data, error } = await supabase
    .from("users")
    .select(
      "id, bteg_id, first_name, last_name, nice_name, position_name, department_name, heltes_name, phone, register_number",
    )
    .eq("is_active", true)
    .eq("organization_id", org as string)
    .or(orConditions.join(","))
    .order("last_name", { nullsFirst: false })
    .limit(limit * 4);

  if (error) {
    console.error("[shift-exchange] searchMyOrgUsers:", error.message);
    return [];
  }

  const lowers = parts.map((p) => p.toLowerCase());
  const filtered = (data ?? []).filter((u) => {
    const hay = [
      u.first_name,
      u.last_name,
      u.nice_name,
      u.position_name,
      u.phone,
      u.register_number,
      u.department_name,
      u.heltes_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return lowers.every((p) => hay.includes(p));
  });
  return filtered.slice(0, limit) as UserSearchResult[];
}

// ── Shift exchanges ─────────────────────────────────────────────────────────
export const getShiftExchanges = cache(
  async (): Promise<ShiftExchangeWithStats[]> => {
    const client = await sb();
    // Synced from target.h_eelj_soliltsoo — show recent + upcoming only.
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 30);
    const { data: exchanges, error } = await client
      .from("shift_exchanges")
      .select("*")
      .gte("exchange_date", cutoff.toISOString().slice(0, 10))
      .order("exchange_date", { ascending: false });
    if (error) {
      console.error("[shift-exchange] getShiftExchanges:", error.message);
      return [];
    }

    const [{ data: buses }, { data: assigns }] = await Promise.all([
      client.from("buses").select("shift_exchange_id"),
      client
        .from("passenger_assignments")
        .select("shift_exchange_id, is_confirmed"),
    ]);

    const busCount = new Map<number, number>();
    for (const b of buses ?? [])
      busCount.set(
        Number(b.shift_exchange_id),
        (busCount.get(Number(b.shift_exchange_id)) ?? 0) + 1,
      );

    const paCount = new Map<number, number>();
    const confCount = new Map<number, number>();
    for (const a of assigns ?? []) {
      const id = Number(a.shift_exchange_id);
      paCount.set(id, (paCount.get(id) ?? 0) + 1);
      if (a.is_confirmed) confCount.set(id, (confCount.get(id) ?? 0) + 1);
    }

    return (exchanges ?? []).map((row) => {
      const e = mapExchange(row);
      return {
        ...e,
        busCount: busCount.get(e.id) ?? 0,
        passengerCount: paCount.get(e.id) ?? 0,
        confirmedCount: confCount.get(e.id) ?? 0,
      };
    });
  },
);

export const getShiftExchange = cache(
  async (id: number): Promise<ShiftExchange | null> => {
    const { data, error } = await (await sb())
      .from("shift_exchanges")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return mapExchange(data);
  },
);

export interface ShiftExchangeInput {
  name: string;
  exchangeDate: string;
  direction: ShiftDirection;
  notes?: string | null;
}

export async function createShiftExchange(
  input: ShiftExchangeInput,
): Promise<ActionResult<{ id: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const createdBy = await currentUserId();
  const { data, error } = await (
    await sb()
  )
    .from("shift_exchanges")
    .insert({
      name: input.name,
      exchange_date: input.exchangeDate,
      direction: input.direction,
      notes: input.notes ?? null,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shift-exchange");
  return { ok: true, id: Number(data.id) };
}

export async function updateShiftExchange(
  id: number,
  input: ShiftExchangeInput,
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await (
    await sb()
  )
    .from("shift_exchanges")
    .update({
      name: input.name,
      exchange_date: input.exchangeDate,
      direction: input.direction,
      notes: input.notes ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shift-exchange");
  revalidatePath(`/shift-exchange/${id}`);
  return { ok: true };
}

export async function setShiftExchangeStatus(
  id: number,
  status: ShiftExchangeStatus,
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const patch: Record<string, unknown> = { status };
  if (status === "published") patch.published_at = new Date().toISOString();
  const { error } = await (await sb())
    .from("shift_exchanges")
    .update(patch)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shift-exchange");
  revalidatePath(`/shift-exchange/${id}`);
  return { ok: true };
}

export async function setExchangeRegistrationOpen(
  id: number,
  open: boolean,
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await (await sb())
    .from("shift_exchanges")
    .update({ open_for_registration: open })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shift-exchange");
  revalidatePath("/shift-exchange/register");
  return { ok: true };
}

/** HR: бүртгэлийн эцсийн хугацааг тодорхой огноо хүртэл түр сунгах (эсвэл цуцлах). */
export async function setRegistrationOverride(
  id: number,
  until: string | null,
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await (await sb())
    .from("shift_exchanges")
    .update({ registration_override_until: until })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/shift-exchange/${id}`);
  revalidatePath(`/shift-exchange/register/${id}`);
  return { ok: true };
}

export async function deleteShiftExchange(id: number): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await (await sb())
    .from("shift_exchanges")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shift-exchange");
  return { ok: true };
}

// ── Buses ───────────────────────────────────────────────────────────────────
async function busDirectionsMap(
  busIds: number[],
): Promise<Map<number, AutobusDirection[]>> {
  const map = new Map<number, AutobusDirection[]>();
  if (!busIds.length) return map;
  const { data } = await (await sb())
    .from("bus_routes")
    .select("bus_id, direction_id, stop_order")
    .in("bus_id", busIds)
    .order("stop_order");
  const directions = await getDirections();
  const dirById = new Map(directions.map((d) => [d.id, d]));
  for (const row of data ?? []) {
    const d = dirById.get(String(row.direction_id));
    if (!d) continue;
    const arr = map.get(Number(row.bus_id)) ?? [];
    arr.push(d);
    map.set(Number(row.bus_id), arr);
  }
  return map;
}

function mapBus(row: unknown): Bus {
  const b = r(row);
  return {
    id: Number(b.id),
    shiftExchangeId: Number(b.shift_exchange_id),
    direction: b.direction as ShiftDirection,
    name: String(b.name ?? ""),
    description: (b.description as string) ?? null,
    capacity: Number(b.capacity),
    departureTime: (b.departure_time as string) ?? null,
    tripLeaderId: (b.trip_leader_id as string) ?? null,
    tripLeaderName: null,
    isActive: Boolean(b.is_active),
    createdAt: (b.created_at as string) ?? null,
    updatedAt: (b.updated_at as string) ?? null,
  };
}

async function decorateBuses(rows: unknown[]): Promise<BusWithStats[]> {
  const buses = rows.map(mapBus);
  const busIds = buses.map((b) => b.id);

  const client = await sb();
  const [{ data: assigns }, dirMap] = await Promise.all([
    busIds.length
      ? client
          .from("passenger_assignments")
          .select("bus_id, is_confirmed")
          .in("bus_id", busIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    busDirectionsMap(busIds),
  ]);

  // trip leader names
  const leaderIds = [
    ...new Set(buses.map((b) => b.tripLeaderId).filter(Boolean)),
  ] as string[];
  const leaderNames = new Map<string, string>();
  if (leaderIds.length) {
    const supabase = await createClient();
    const { data: leaders } = await supabase
      .from("users")
      .select("id, first_name, last_name")
      .in("id", leaderIds);
    for (const l of leaders ?? [])
      leaderNames.set(
        String(l.id),
        `${l.last_name ?? ""} ${l.first_name ?? ""}`.trim(),
      );
  }

  const paCount = new Map<number, number>();
  const confCount = new Map<number, number>();
  for (const a of assigns ?? []) {
    const id = Number(a.bus_id);
    paCount.set(id, (paCount.get(id) ?? 0) + 1);
    if (a.is_confirmed) confCount.set(id, (confCount.get(id) ?? 0) + 1);
  }

  return buses.map((b) => ({
    ...b,
    tripLeaderName: b.tripLeaderId
      ? (leaderNames.get(b.tripLeaderId) ?? null)
      : null,
    passengerCount: paCount.get(b.id) ?? 0,
    confirmedCount: confCount.get(b.id) ?? 0,
    directions: dirMap.get(b.id) ?? [],
  }));
}

export const getBusesForExchange = cache(async function getBusesForExchange(
  exchangeId: number,
): Promise<BusWithStats[]> {
  const { data, error } = await (await sb())
    .from("buses")
    .select("*")
    .eq("shift_exchange_id", exchangeId)
    .order("id");
  if (error) {
    console.error("[shift-exchange] getBusesForExchange:", error.message);
    return [];
  }
  const buses = await decorateBuses(data ?? []);
  // Нэрээр эрэмбэлнэ (тоог зөв ойлгож: "#2" < "#10"). Бүх жагсаалт нэг дараалалтай.
  return buses.sort((a, b) =>
    a.name.localeCompare(b.name, "mn", { numeric: true, sensitivity: "base" }),
  );
});

export interface BusLeaderRow {
  displayName: string;
  albaOrHeltes: string | null;
  positionName: string | null;
  directionName: string | null;
  phone: string | null;
}

/** Автобусны аялалын ахлахын дэлгэц дээр харуулах мэдээлэл (1-р мөр болгоход). */
export async function getBusLeader(
  userId: string | null,
): Promise<BusLeaderRow | null> {
  if (!userId) return null;
  const supabase = await createClient();
  const { data: u } = await supabase
    .from("users")
    .select(
      "first_name, last_name, phone, department_id, department_name, heltes_name, position_name, autobus_direction_id",
    )
    .eq("id", userId)
    .maybeSingle();
  if (!u) return null;
  const directions = await getDirections();
  const dirByBteg = new Map(directions.map((d) => [d.btegId, d.name]));
  const dirBteg = u.autobus_direction_id
    ? String(u.autobus_direction_id)
    : null;
  return {
    displayName:
      `${u.last_name ?? ""} ${u.first_name ?? ""}`.trim() || "Нэргүй",
    albaOrHeltes: u.department_id
      ? ((u.department_name as string) ?? null)
      : ((u.heltes_name as string) ?? null),
    positionName: (u.position_name as string) ?? null,
    directionName: dirBteg ? (dirByBteg.get(dirBteg) ?? null) : null,
    phone: (u.phone as string) ?? null,
  };
}

export async function getBus(busId: number): Promise<BusWithStats | null> {
  const { data, error } = await (await sb())
    .from("buses")
    .select("*")
    .eq("id", busId)
    .maybeSingle();
  if (error || !data) return null;
  const [bus] = await decorateBuses([data]);
  return bus ?? null;
}

export interface BusInput {
  direction: ShiftDirection;
  name: string;
  description?: string | null;
  capacity: number;
  departureTime?: string | null;
  tripLeaderId?: string | null;
  directionIds: string[]; // autobus_direction.id (uuid)
}

export async function createBus(
  exchangeId: number,
  input: BusInput,
): Promise<ActionResult<{ id: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const client = await sb();
  const { data, error } = await client
    .from("buses")
    .insert({
      shift_exchange_id: exchangeId,
      direction: input.direction,
      name: input.name,
      description: input.description ?? null,
      capacity: input.capacity,
      departure_time: input.departureTime ?? null,
      trip_leader_id: input.tripLeaderId ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return {
        ok: false,
        error: "Энэ хүн энэ ээлжийн өөр автобусанд аялалын ахлах болсон байна",
      };
    return { ok: false, error: error.message };
  }

  const busId = Number(data.id);
  if (input.directionIds.length) {
    const { error: rErr } = await client.from("bus_routes").insert(
      input.directionIds.map((dirId, i) => ({
        bus_id: busId,
        direction_id: dirId,
        stop_order: i + 1,
      })),
    );
    if (rErr) return { ok: false, error: rErr.message };
  }
  revalidatePath(`/shift-exchange/${exchangeId}`);
  return { ok: true, id: busId };
}

/** Change (or clear) a bus's trip leader inline. The trg_sync_bus_trip_leader
 *  trigger keeps bgs_attendance.trip_leaders in sync automatically. */
export async function setBusTripLeader(
  busId: number,
  exchangeId: number,
  tripLeaderId: string | null,
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await (await sb())
    .from("buses")
    .update({ trip_leader_id: tripLeaderId })
    .eq("id", busId);
  if (error) {
    if (error.code === "23505")
      return {
        ok: false,
        error: "Энэ хүн энэ ээлжийн өөр автобусанд аялалын ахлах болсон байна",
      };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/shift-exchange/${exchangeId}`);
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${busId}`);
  return { ok: true };
}

export async function updateBus(
  busId: number,
  exchangeId: number,
  input: BusInput,
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const client = await sb();
  const { error } = await client
    .from("buses")
    .update({
      direction: input.direction,
      name: input.name,
      description: input.description ?? null,
      capacity: input.capacity,
      departure_time: input.departureTime ?? null,
      trip_leader_id: input.tripLeaderId ?? null,
    })
    .eq("id", busId);
  if (error) {
    if (error.code === "23505")
      return {
        ok: false,
        error: "Энэ хүн энэ ээлжийн өөр автобусанд аялалын ахлах болсон байна",
      };
    return { ok: false, error: error.message };
  }

  // replace routes
  await client.from("bus_routes").delete().eq("bus_id", busId);
  if (input.directionIds.length) {
    await client.from("bus_routes").insert(
      input.directionIds.map((dirId, i) => ({
        bus_id: busId,
        direction_id: dirId,
        stop_order: i + 1,
      })),
    );
  }
  revalidatePath(`/shift-exchange/${exchangeId}`);
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${busId}`);
  return { ok: true };
}

/** Delete a bus; its passengers are moved back to the pool (not deleted). */
export async function deleteBus(
  busId: number,
  exchangeId: number,
): Promise<ActionResult<{ movedToPool: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { data, error } = await (
    await sb()
  ).rpc("delete_bus", {
    p_bus_id: busId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/shift-exchange/${exchangeId}`);
  revalidatePath("/shift-exchange");
  return { ok: true, movedToPool: Number(data ?? 0) };
}

// ── Passenger assignments ────────────────────────────────────────────────────
// Shared mapper: enrich raw passenger_assignments rows with user / org /
// direction display fields. Every passenger is now a public.users row.
async function mapAssignmentRows(
  rows: Record<string, unknown>[],
): Promise<PassengerAssignment[]> {
  const internalIds = [
    ...new Set(rows.map((a) => a.internal_user_id).filter(Boolean)),
  ] as string[];

  const [directions, orgNames] = await Promise.all([
    getDirections(),
    getOrgNameMap(),
  ]);
  const dirByBteg = new Map(directions.map((d) => [d.btegId, d.name]));

  const userMap = new Map<string, Record<string, unknown>>();
  if (internalIds.length) {
    const supabase = await createClient();
    const { data: users } = await supabase
      .from("users")
      .select(
        "id, first_name, last_name, position_name, department_name, heltes_name, organization_id, autobus_direction_id, phone",
      )
      .in("id", internalIds);
    for (const u of users ?? []) userMap.set(String(u.id), u);
  }

  // companion group (хамтрагч бүлэг) — хэрэглэгч тус бүрийн бүлэг
  const companionMap = new Map<string, { id: number; name: string }>();
  if (internalIds.length) {
    const client = await sb();
    const { data: members } = await client
      .from("companion_group_members")
      .select("internal_user_id, group_id")
      .in("internal_user_id", internalIds);
    const groupIds = [
      ...new Set((members ?? []).map((m) => Number(m.group_id))),
    ];
    const groupNames = new Map<number, string>();
    if (groupIds.length) {
      const { data: groups } = await client
        .from("companion_groups")
        .select("id, name")
        .in("id", groupIds);
      for (const g of groups ?? [])
        groupNames.set(Number(g.id), String(g.name ?? ""));
    }
    for (const m of members ?? [])
      companionMap.set(String(m.internal_user_id), {
        id: Number(m.group_id),
        name: groupNames.get(Number(m.group_id)) ?? "",
      });
  }

  return rows.map((row) => {
    const a = r(row);
    const internalUserId = String(a.internal_user_id);
    const u = userMap.get(internalUserId);

    const displayName = `${u?.last_name ?? ""} ${u?.first_name ?? ""}`.trim();
    const positionName = (u?.position_name as string) ?? null;
    const albaName = (u?.department_name as string) ?? null;
    const heltesName = (u?.heltes_name as string) ?? null;
    const organizationId = (u?.organization_id as string) ?? null;
    const organizationName = organizationId
      ? (orgNames.get(organizationId) ?? null)
      : null;
    const phone = (u?.phone as string) ?? null;

    // Prefer the snapshot stored on the assignment; fall back to the user's
    // current direction (legacy rows before the snapshot column).
    const snapshotDirBteg =
      a.autobus_direction_id != null ? String(a.autobus_direction_id) : null;
    const fallbackDirBteg = u?.autobus_direction_id as string | undefined;
    const directionName =
      (snapshotDirBteg ? dirByBteg.get(snapshotDirBteg) : undefined) ??
      (fallbackDirBteg ? dirByBteg.get(fallbackDirBteg) : undefined) ??
      null;

    return {
      id: Number(a.id),
      shiftExchangeId: Number(a.shift_exchange_id),
      busId: a.bus_id != null ? Number(a.bus_id) : null,
      internalUserId,
      isConfirmed: Boolean(a.is_confirmed),
      confirmedAt: (a.confirmed_at as string) ?? null,
      notes: (a.notes as string) ?? null,
      displayName,
      firstName: (u?.first_name as string) ?? null,
      lastName: (u?.last_name as string) ?? null,
      positionName,
      albaName,
      heltesName,
      organizationId,
      organizationName,
      directionBtegId: snapshotDirBteg,
      directionName,
      phone,
      companionGroupId: companionMap.get(internalUserId)?.id ?? null,
      companionGroupName: companionMap.get(internalUserId)?.name ?? null,
    } satisfies PassengerAssignment;
  });
}

/** HR: manually set QR-confirmed state on many passengers. */
export async function setPassengersConfirmed(
  assignmentIds: number[],
  confirmed: boolean,
  exchangeId: number,
  busId: number,
): Promise<ActionResult<{ count: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  if (assignmentIds.length === 0) return { ok: true, count: 0 };
  const { data, error } = await (
    await sb()
  ).rpc("set_passengers_confirmed", {
    p_assignment_ids: assignmentIds,
    p_confirmed: confirmed,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/shift-exchange/${exchangeId}`);
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${busId}`);
  return { ok: true, count: Number(data ?? 0) };
}

/** Passengers assigned to a specific bus. */
export async function getAssignments(
  busId: number,
): Promise<PassengerAssignment[]> {
  const { data, error } = await (await sb())
    .from("passenger_assignments")
    .select("*")
    .eq("bus_id", busId)
    .order("id");
  if (error) {
    console.error("[shift-exchange] getAssignments:", error.message);
    return [];
  }
  return mapAssignmentRows(data ?? []);
}

/** Pool: passengers submitted to an exchange but not yet on a bus. */
export async function getPoolAssignments(
  exchangeId: number,
): Promise<PassengerAssignment[]> {
  const { data, error } = await (await sb())
    .from("passenger_assignments")
    .select("*")
    .eq("shift_exchange_id", exchangeId)
    .is("bus_id", null)
    .order("id");
  if (error) {
    console.error("[shift-exchange] getPoolAssignments:", error.message);
    return [];
  }
  return mapAssignmentRows(data ?? []);
}

/** The caller's OWN organization's assignments in an exchange (pool + bus).
 *  Used by the submit panel. Filtered by org explicitly so it is correct even
 *  for admin/super_admin (whose RLS returns every row). */
export async function getMyExchangeSubmissions(
  exchangeId: number,
): Promise<PassengerAssignment[]> {
  const supabase = await createClient();
  const { data: org } = await supabase.rpc("current_user_org_id");
  if (!org) return [];
  const { data, error } = await (await sb())
    .from("passenger_assignments")
    .select("*")
    .eq("shift_exchange_id", exchangeId)
    .order("id");
  if (error) {
    console.error("[shift-exchange] getMyExchangeSubmissions:", error.message);
    return [];
  }
  const mapped = await mapAssignmentRows(data ?? []);
  return mapped.filter((a) => a.organizationId === String(org));
}

export async function bulkAssignPassengers(
  busId: number,
  eeljGroupBtegId: string,
  directionIds: string[],
  orderByAlba: boolean,
): Promise<ActionResult<BulkAssignResult>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { data, error } = await (
    await sb()
  ).rpc("bulk_assign_passengers", {
    p_bus_id: busId,
    p_eelj_group_bteg_id: eeljGroupBtegId,
    p_direction_ids: directionIds.length ? directionIds : null,
    p_order_by_alba: orderByAlba,
  });
  if (error) return { ok: false, error: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  revalidatePath(`/shift-exchange`);
  return {
    ok: true,
    inserted: Number(row?.inserted ?? 0),
    skippedCapacity: Number(row?.skipped_capacity ?? 0),
  };
}

async function busExchangeId(busId: number): Promise<number | null> {
  const { data } = await (await sb())
    .from("buses")
    .select("shift_exchange_id")
    .eq("id", busId)
    .maybeSingle();
  return data ? Number(data.shift_exchange_id) : null;
}

export async function addInternalPassenger(
  busId: number,
  userId: string,
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const exchangeId = await busExchangeId(busId);
  if (!exchangeId) return { ok: false, error: "Автобус олдсонгүй" };

  // capacity guard
  const { data: cap } = await (
    await sb()
  ).rpc("check_bus_capacity", { p_bus_id: busId });
  const c = (Array.isArray(cap) ? cap[0] : cap) as Record<string, unknown>;
  if (c?.is_full) return { ok: false, error: "Автобус дүүрсэн байна" };

  const { error } = await (await sb()).from("passenger_assignments").insert({
    shift_exchange_id: exchangeId,
    bus_id: busId,
    internal_user_id: userId,
  });
  if (error) {
    if (error.code === "23505")
      return {
        ok: false,
        error: "Энэ ажилтан энэ ээлжид аль хэдийн хуваарилагдсан",
      };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${busId}`);
  return { ok: true };
}

/** HR: bulk-assign an organization to a bus (moves pooled rows first, then inserts). */
export async function bulkAssignByOrg(
  busId: number,
  orgBtegId: string,
  orderByAlba: boolean,
): Promise<ActionResult<BulkByOrgResult>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const exchangeId = await busExchangeId(busId);
  const { data, error } = await (
    await sb()
  ).rpc("bulk_assign_by_org", {
    p_bus_id: busId,
    p_org_bteg_id: orgBtegId,
    p_order_by_alba: orderByAlba,
  });
  if (error) return { ok: false, error: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  if (exchangeId) {
    revalidatePath(`/shift-exchange/${exchangeId}`);
    revalidatePath(`/shift-exchange/${exchangeId}/buses/${busId}`);
  }
  return {
    ok: true,
    assigned: Number(row?.assigned ?? 0),
    skippedCapacity: Number(row?.skipped_capacity ?? 0),
  };
}

/** Rep (or HR): submit own-organization users into the exchange pool (bus_id NULL). */
export async function submitPassengersToPool(
  exchangeId: number,
  userIds: string[],
): Promise<ActionResult<SubmitPoolResult>> {
  const canSubmit =
    (await hasPermission("shift_exchange", "submit")) ||
    (await hasPermission("shift_exchange", "view"));
  if (!canSubmit) return { ok: false, error: "Танд эрх алга" };
  if (!userIds.length) return { ok: false, error: "Хэн ч сонгогдоогүй" };

  const { data, error } = await (
    await sb()
  ).rpc("submit_passengers_to_pool", {
    p_shift_exchange_id: exchangeId,
    p_user_ids: userIds,
  });
  if (error) return { ok: false, error: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  revalidatePath(`/shift-exchange/${exchangeId}`);
  return {
    ok: true,
    inserted: Number(row?.inserted ?? 0),
    skipped: Number(row?.skipped ?? 0),
  };
}

/** Rep/HR: remove an own pool submission (RLS enforces org + pool + unconfirmed). */
export async function removePoolSubmission(
  assignmentId: number,
  exchangeId: number,
): Promise<ActionResult> {
  const canSubmit =
    (await hasPermission("shift_exchange", "submit")) ||
    (await hasPermission("shift_exchange", "view"));
  if (!canSubmit) return { ok: false, error: "Танд эрх алга" };
  // bus_id IS NULL шүүлт хассан — автобусанд хуваарилагдсан зорчигчийг ч устгана
  // (RLS нь өөрийн org + баталгаажаагүйг л зөвшөөрнө).
  const { error } = await (await sb())
    .from("passenger_assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/shift-exchange/${exchangeId}`);
  revalidatePath(`/shift-exchange/register/${exchangeId}`);
  return { ok: true };
}

/** Rep: bulk-remove many of own-org submissions (RLS limits to own org + unconfirmed). */
export async function removePoolSubmissions(
  assignmentIds: number[],
  exchangeId: number,
): Promise<ActionResult<{ count: number }>> {
  const canSubmit =
    (await hasPermission("shift_exchange", "submit")) ||
    (await hasPermission("shift_exchange", "view"));
  if (!canSubmit) return { ok: false, error: "Танд эрх алга" };
  if (assignmentIds.length === 0) return { ok: true, count: 0 };
  // Хугацааны шалгалт (HR биш бол) — найрсаг алдаа өгөхийн тулд.
  const isHR = await hasPermission("shift_exchange", "view");
  if (!isHR) {
    const { data: open } = await (
      await sb()
    ).rpc("rep_can_register", {
      p_exchange_id: exchangeId,
    });
    if (!open) return { ok: false, error: "Бүртгэлийн хугацаа дууссан байна" };
  }
  const { data, error } = await (await sb())
    .from("passenger_assignments")
    .delete()
    .in("id", assignmentIds)
    .select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/shift-exchange/${exchangeId}`);
  revalidatePath(`/shift-exchange/register/${exchangeId}`);
  return { ok: true, count: data?.length ?? 0 };
}

/** HR: send an assignment back to the pool (bus_id NULL). */
export async function unassignToPool(
  assignmentId: number,
  exchangeId: number,
  busId: number,
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await (
    await sb()
  ).rpc("unassign_to_pool", {
    p_assignment_id: assignmentId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/shift-exchange/${exchangeId}`);
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${busId}`);
  return { ok: true };
}

/** HR: bulk-send many assignments back to the pool in one round-trip. */
export async function bulkUnassignToPool(
  assignmentIds: number[],
  exchangeId: number,
  busId: number,
): Promise<ActionResult<{ count: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  if (assignmentIds.length === 0) return { ok: true, count: 0 };
  const { data, error } = await (
    await sb()
  ).rpc("bulk_unassign_to_pool", {
    p_assignment_ids: assignmentIds,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/shift-exchange/${exchangeId}`);
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${busId}`);
  return { ok: true, count: Number(data ?? 0) };
}

/** HR: bulk-transfer many assignments to another bus (capacity-limited). */
export async function bulkTransferPassengers(
  assignmentIds: number[],
  targetBusId: number,
  exchangeId: number,
  fromBusId: number,
): Promise<ActionResult<{ transferred: number; skippedCapacity: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  if (assignmentIds.length === 0)
    return { ok: true, transferred: 0, skippedCapacity: 0 };
  const { data, error } = await (
    await sb()
  ).rpc("bulk_transfer_passengers", {
    p_assignment_ids: assignmentIds,
    p_target_bus_id: targetBusId,
  });
  if (error) return { ok: false, error: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${fromBusId}`);
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${targetBusId}`);
  return {
    ok: true,
    transferred: Number(row?.transferred ?? 0),
    skippedCapacity: Number(row?.skipped_capacity ?? 0),
  };
}

export async function removePassenger(
  assignmentId: number,
  busId: number,
  exchangeId: number,
  force = false,
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const client = await sb();
  if (!force) {
    const { data } = await client
      .from("passenger_assignments")
      .select("is_confirmed")
      .eq("id", assignmentId)
      .maybeSingle();
    if (data?.is_confirmed)
      return {
        ok: false,
        error: "Баталгаажсан зорчигчийг устгахын тулд баталгаажуул",
      };
  }
  const { error } = await client
    .from("passenger_assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${busId}`);
  return { ok: true };
}

// ── Report manifest ──────────────────────────────────────────────────────────
export interface ReportRow {
  assignmentId: number;
  busId: number | null;
  busName: string;
  passengerName: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  alba: string | null;
  organizationName: string | null;
  directionName: string | null;
  phone: string | null;
  confirmed: boolean;
}

export async function getReportRows(exchangeId: number): Promise<ReportRow[]> {
  if (!(await hasPermission("shift_exchange", "view"))) return [];

  // Бүх зорчигчийг (автобустай + хуваарилаагүй) НЭГ query-ээр аваад нэг удаа баяжуулна.
  // (Өмнө автобус тус бүрээр дараалан татдаг байсан → N+1.)
  const client = await sb();
  const [res, buses] = await Promise.all([
    client
      .from("passenger_assignments")
      .select("*")
      .eq("shift_exchange_id", exchangeId)
      .order("id"),
    getBusesForExchange(exchangeId),
  ]);
  const busName = new Map(buses.map((b) => [b.id, b.name]));
  const all = await mapAssignmentRows(res.data ?? []);

  return all.map((a) => ({
    assignmentId: a.id,
    busId: a.busId,
    busName:
      a.busId != null ? (busName.get(a.busId) ?? "—") : "(хуваарилаагүй)",
    passengerName: a.displayName,
    firstName: a.firstName,
    lastName: a.lastName,
    position: a.positionName,
    alba: a.albaName,
    organizationName: a.organizationName,
    directionName: a.directionName,
    phone: a.phone,
    confirmed: a.isConfirmed,
  }));
}

// ── Excel экспорт (автобус тус бүрээр sheet) ─────────────────────────────────
export interface BusExportPassenger {
  isLeader: boolean;
  eeljGroupName: string | null;
  albaOrHeltes: string | null;
  position: string | null;
  lastName: string | null;
  firstName: string | null;
  phone: string | null;
  directionName: string | null;
}
export interface BusExportSheet {
  name: string;
  passengers: BusExportPassenger[];
}
export interface BusExportData {
  exchange: { name: string; date: string; directionLabel: string } | null;
  buses: BusExportSheet[];
}

/** Excel экспортод зориулсан өгөгдөл: ээлжийн мэдээлэл + автобус бүрийн зорчигчид. */
export async function getBusExportData(
  exchangeId: number,
): Promise<BusExportData> {
  if (!(await hasPermission("shift_exchange", "view"))) return { exchange: null, buses: [] };

  const [exchange, buses] = await Promise.all([
    getShiftExchange(exchangeId),
    getBusesForExchange(exchangeId),
  ]);
  if (!exchange) return { exchange: null, buses: [] };

  // Бүх зорчигчийг НЭГ query-ээр аваад автобусаар нь бүлэглэнэ (N+1-аас сэргийлж).
  const client = await sb();
  const { data: allRows } = await client
    .from("passenger_assignments")
    .select("*")
    .eq("shift_exchange_id", exchangeId)
    .not("bus_id", "is", null)
    .order("id");
  const enriched = await mapAssignmentRows(allRows ?? []);
  const byBus = new Map<number, PassengerAssignment[]>();
  for (const a of enriched) {
    if (a.busId == null) continue;
    const list = byBus.get(a.busId);
    if (list) list.push(a);
    else byBus.set(a.busId, [a]);
  }
  const assignsPerBus = buses.map((b) => byBus.get(b.id) ?? []);

  // eelj_groups.name + аялалын ахлахын дэлгэрэнгүй (нэр/утас)
  const userIds = new Set<string>();
  for (const list of assignsPerBus)
    for (const a of list) if (a.internalUserId) userIds.add(a.internalUserId);
  for (const b of buses) if (b.tripLeaderId) userIds.add(b.tripLeaderId);

  const directions = await getDirections();
  const dirByBteg = new Map(directions.map((d) => [d.btegId, d.name]));

  const eeljByUser = new Map<string, string>();
  const albaByUser = new Map<string, string | null>();
  const userDetail = new Map<
    string,
    {
      first: string | null;
      last: string | null;
      phone: string | null;
      position: string | null;
      directionName: string | null;
    }
  >();
  if (userIds.size) {
    const supabase = await createClient();
    const { data: us } = await supabase
      .from("users")
      .select(
        "id, sf_guard_group_id, phone, first_name, last_name, department_id, department_name, heltes_name, position_name, autobus_direction_id",
      )
      .in("id", [...userIds]);
    const groupIds = [
      ...new Set((us ?? []).map((u) => u.sf_guard_group_id).filter(Boolean)),
    ] as string[];
    const groupName = new Map<string, string>();
    if (groupIds.length) {
      const { data: gs } = await supabase
        .from("eelj_groups")
        .select("bteg_id, name")
        .in("bteg_id", groupIds);
      for (const g of gs ?? [])
        groupName.set(String(g.bteg_id), String(g.name ?? ""));
    }
    for (const u of us ?? []) {
      const gid = u.sf_guard_group_id ? String(u.sf_guard_group_id) : null;
      if (gid && groupName.has(gid)) eeljByUser.set(String(u.id), groupName.get(gid)!);
      // Алба (department_id) байвал албаны нэр, эс бөгөөс хэлтсийн нэр.
      albaByUser.set(
        String(u.id),
        u.department_id
          ? ((u.department_name as string) ?? null)
          : ((u.heltes_name as string) ?? null),
      );
      const dirBteg = u.autobus_direction_id
        ? String(u.autobus_direction_id)
        : null;
      userDetail.set(String(u.id), {
        first: (u.first_name as string) ?? null,
        last: (u.last_name as string) ?? null,
        phone: (u.phone as string) ?? null,
        position: (u.position_name as string) ?? null,
        directionName: dirBteg ? (dirByBteg.get(dirBteg) ?? null) : null,
      });
    }
  }

  const directionLabel = exchange.direction === "arriving" ? "Ирэх" : "Буух";

  const sheets: BusExportSheet[] = buses.map((b, i) => {
    const passengers: BusExportPassenger[] = [];
    // Аялалын ахлах = 1 дэх зорчигч (тусдаа хүн, жагсаалтын эхэнд).
    const leader = b.tripLeaderId ? userDetail.get(b.tripLeaderId) : null;
    if (leader) {
      passengers.push({
        isLeader: true,
        eeljGroupName: eeljByUser.get(b.tripLeaderId!) ?? null,
        albaOrHeltes: albaByUser.get(b.tripLeaderId!) ?? null,
        position: leader.position,
        lastName: leader.last,
        firstName: leader.first,
        phone: leader.phone,
        directionName: leader.directionName,
      });
    }
    for (const a of assignsPerBus[i]) {
      passengers.push({
        isLeader: false,
        eeljGroupName: eeljByUser.get(a.internalUserId) ?? null,
        albaOrHeltes:
          albaByUser.get(a.internalUserId) ?? a.albaName ?? a.heltesName ?? null,
        position: a.positionName,
        lastName: a.lastName,
        firstName: a.firstName,
        phone: a.phone,
        directionName: a.directionName,
      });
    }
    return { name: b.name, passengers };
  });

  return {
    exchange: { name: exchange.name, date: exchange.exchangeDate, directionLabel },
    buses: sheets,
  };
}

export async function transferPassenger(
  assignmentId: number,
  targetBusId: number,
  exchangeId: number,
  fromBusId: number,
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { error } = await (
    await sb()
  ).rpc("transfer_passenger", {
    p_assignment_id: assignmentId,
    p_target_bus_id: targetBusId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${fromBusId}`);
  revalidatePath(`/shift-exchange/${exchangeId}/buses/${targetBusId}`);
  return { ok: true };
}

// ── Linked eelj groups + auto-assign ─────────────────────────────────────────
export async function getLinkedGroups(
  exchangeId: number,
): Promise<LinkedGroup[]> {
  const { data, error } = await (await sb())
    .from("shift_exchange_groups")
    .select("group_bteg_id")
    .eq("shift_exchange_id", exchangeId);
  if (error) {
    console.error("[shift-exchange] getLinkedGroups:", error.message);
    return [];
  }
  const ids = (data ?? []).map((r) => String(r.group_bteg_id));
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data: groups } = await supabase
    .from("eelj_groups")
    .select("bteg_id, name")
    .in("bteg_id", ids);
  const nameMap = new Map(
    (groups ?? []).map((g) => [String(g.bteg_id), (g.name as string) ?? ""]),
  );
  return ids
    .map((id) => ({ btegId: id, name: nameMap.get(id) ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Smart distribute: auto-create buses per direction and fill them from the pool.
 * Idempotent — only touches bus_id IS NULL rows, so already-assigned / confirmed
 * passengers are never moved. Re-running tops up existing direction buses first.
 */
export async function autoDistributePool(
  exchangeId: number,
): Promise<ActionResult<AutoDistributeResult>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { data, error } = await (
    await sb()
  ).rpc("auto_distribute_pool", {
    p_exchange_id: exchangeId,
    p_capacity: 45,
  });
  if (error) return { ok: false, error: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  revalidatePath(`/shift-exchange/${exchangeId}`);
  revalidatePath("/shift-exchange");
  return {
    ok: true,
    busesCreated: Number(row?.buses_created ?? 0),
    assigned: Number(row?.assigned ?? 0),
    stillPooled: Number(row?.still_pooled ?? 0),
  };
}

/** Link an eelj group and add its workers to the POOL (хуваарилаагүй жагсаалт).
 *  Автобусанд хуваарилахгүй — хуваарилалт зөвхөн "Ухаалаг хуваарилах"-аар. */
export async function linkAndAssignGroup(
  exchangeId: number,
  groupBtegId: string,
): Promise<ActionResult<{ added: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { error: linkErr } = await (await sb())
    .from("shift_exchange_groups")
    .upsert(
      { shift_exchange_id: exchangeId, group_bteg_id: groupBtegId },
      { onConflict: "shift_exchange_id,group_bteg_id" },
    );
  if (linkErr) return { ok: false, error: linkErr.message };
  const { data, error } = await (await sb()).rpc("add_eelj_group_to_pool", {
    p_exchange_id: exchangeId,
    p_group_bteg_id: groupBtegId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/shift-exchange/${exchangeId}`);
  return { ok: true, added: Number(data ?? 0) };
}

/** Unlink a group and remove its unconfirmed workers from the exchange
 *  (pool + bus). QR-confirmed workers are kept. */
export async function unlinkGroup(
  exchangeId: number,
  groupBtegId: string,
): Promise<ActionResult<{ removed: number; keptConfirmed: number }>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  const { data, error } = await (
    await sb()
  ).rpc("unlink_group", {
    p_exchange_id: exchangeId,
    p_group_bteg_id: groupBtegId,
  });
  if (error) return { ok: false, error: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  revalidatePath(`/shift-exchange/${exchangeId}`);
  return {
    ok: true,
    removed: Number(row?.removed ?? 0),
    keptConfirmed: Number(row?.kept_confirmed ?? 0),
  };
}
