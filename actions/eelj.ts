"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type {
  EeljCard,
  EeljRequestStatus,
  EeljShift,
  MyEeljAssignment,
  MyEeljRequest,
  PendingRequest,
  RequestableAutobus,
  RosterAutobus,
  RosterEntry,
} from "@/types/eelj";

const getUpcomingCached = cache(
  async (limit: number): Promise<EeljShift[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_upcoming_eelj", {
      p_limit: limit,
    });
    if (error) {
      console.error("[eelj] get_upcoming_eelj failed:", error.message);
      return [];
    }
    return ((data as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: Number(r.id),
        name: String(r.name ?? ""),
        dayDate: String(r.day_date),
        isCome: Boolean(r.is_come),
      };
    });
  },
);

export async function getUpcomingEelj(limit = 10) {
  return getUpcomingCached(limit);
}

const getMyAssignmentsCached = cache(
  async (): Promise<MyEeljAssignment[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_my_eelj_assignments");
    if (error) {
      console.error("[eelj] get_my_eelj_assignments failed:", error.message);
      return [];
    }
    return ((data as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        eeljId: Number(r.eelj_id),
        eeljName: String(r.eelj_name ?? ""),
        dayDate: String(r.day_date),
        isCome: Boolean(r.is_come),
        autobusId: r.autobus_id != null ? Number(r.autobus_id) : null,
        autobusNumber: (r.autobus_number as string) ?? null,
        directionName: (r.direction_name as string) ?? null,
        driverName: (r.driver_name as string) ?? null,
        driverPhone: (r.driver_phone as string) ?? null,
        sitNumber: r.sit_number != null ? Number(r.sit_number) : null,
        landPositionAddress: (r.land_position_address as string) ?? null,
        isDone: Boolean(r.is_done),
      };
    });
  },
);

export async function getMyEeljAssignments() {
  return getMyAssignmentsCached();
}

const getRosterCached = cache(async (): Promise<RosterAutobus[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_led_autobus_roster");
  if (error) {
    console.error("[eelj] get_my_led_autobus_roster failed:", error.message);
    return [];
  }
  const rows = ((data as unknown[]) ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      autobusId: Number(r.autobus_id),
      autobusNumber: String(r.autobus_number ?? ""),
      dayDate: String(r.day_date),
      eeljId: Number(r.eelj_id),
      eeljName: String(r.eelj_name ?? ""),
      isCome: Boolean(r.is_come),
      directionName: (r.direction_name as string) ?? null,
      passengerBtegId: (r.passenger_bteg_id as string) ?? null,
      passengerFirstName: (r.passenger_first_name as string) ?? null,
      passengerLastName: (r.passenger_last_name as string) ?? null,
      passengerPhone: (r.passenger_phone as string) ?? null,
      sitNumber: r.sit_number != null ? Number(r.sit_number) : null,
      landPositionAddress: (r.land_position_address as string) ?? null,
      isDone: Boolean(r.is_done),
    } satisfies RosterEntry;
  });

  const groups = new Map<number, RosterAutobus>();
  for (const row of rows) {
    let bus = groups.get(row.autobusId);
    if (!bus) {
      bus = {
        autobusId: row.autobusId,
        autobusNumber: row.autobusNumber,
        dayDate: row.dayDate,
        eeljId: row.eeljId,
        eeljName: row.eeljName,
        isCome: row.isCome,
        directionName: row.directionName,
        passengers: [],
      };
      groups.set(row.autobusId, bus);
    }
    if (row.passengerBtegId != null) {
      bus.passengers.push(row);
    }
  }
  return [...groups.values()];
});

export async function getMyLedRoster() {
  return getRosterCached();
}

const getMyRequestsCached = cache(async (): Promise<MyEeljRequest[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_eelj_requests");
  if (error) {
    console.error("[eelj] get_my_eelj_requests failed:", error.message);
    return [];
  }
  return ((data as unknown[]) ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: Number(r.id),
      eeljId: Number(r.eelj_id),
      eeljName: String(r.eelj_name ?? ""),
      autobusId: Number(r.autobus_id),
      autobusNumber: (r.autobus_number as string) ?? null,
      directionName: (r.direction_name as string) ?? null,
      status: r.status as EeljRequestStatus,
      comment: (r.comment as string) ?? null,
      requestedAt: String(r.requested_at),
      decidedAt: (r.decided_at as string) ?? null,
      decisionReason: (r.decision_reason as string) ?? null,
    };
  });
});

export async function getMyEeljRequests() {
  return getMyRequestsCached();
}

const getPendingForLeaderCached = cache(
  async (): Promise<PendingRequest[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "get_pending_requests_for_my_autobuses",
    );
    if (error) {
      console.error(
        "[eelj] get_pending_requests_for_my_autobuses failed:",
        error.message,
      );
      return [];
    }
    return ((data as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: Number(r.id),
        eeljId: Number(r.eelj_id),
        eeljName: String(r.eelj_name ?? ""),
        autobusId: Number(r.autobus_id),
        autobusNumber: (r.autobus_number as string) ?? null,
        directionName: (r.direction_name as string) ?? null,
        requesterBtegId:
          r.requester_bteg_id != null ? Number(r.requester_bteg_id) : null,
        requesterFirstName: (r.requester_first_name as string) ?? null,
        requesterLastName: (r.requester_last_name as string) ?? null,
        requesterPhone: (r.requester_phone as string) ?? null,
        requesterPosition: (r.requester_position as string) ?? null,
        requesterDepartment: (r.requester_department as string) ?? null,
        status: r.status as EeljRequestStatus,
        comment: (r.comment as string) ?? null,
        requestedAt: String(r.requested_at),
      };
    });
  },
);

export async function getPendingRequestsForLeader() {
  return getPendingForLeaderCached();
}

const getRequestableCached = cache(
  async (limit: number): Promise<RequestableAutobus[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_requestable_autobuses", {
      p_limit: limit,
    });
    if (error) {
      console.error("[eelj] get_requestable_autobuses failed:", error.message);
      return [];
    }
    return ((data as unknown[]) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        autobusId: Number(r.autobus_id),
        autobusNumber: String(r.autobus_number ?? ""),
        eeljId: Number(r.eelj_id),
        eeljName: String(r.eelj_name ?? ""),
        dayDate: String(r.day_date),
        isCome: Boolean(r.is_come),
        directionName: (r.direction_name as string) ?? null,
        driverName: (r.driver_name as string) ?? null,
        alreadyRequested: Boolean(r.already_requested),
      };
    });
  },
);

export async function getRequestableAutobuses(limit = 30) {
  return getRequestableCached(limit);
}

export async function requestAutobusSeat(formData: FormData) {
  const eeljId = Number(formData.get("eelj_id"));
  const autobusId = Number(formData.get("autobus_id"));
  const comment = (formData.get("comment") as string) || null;

  if (!eeljId || !autobusId) {
    return { ok: false as const, error: "Ээлж эсвэл автобус сонгогдоогүй" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_autobus_seat", {
    p_eelj_id: eeljId,
    p_autobus_id: autobusId,
    p_comment: comment,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/eelj");
  return { ok: true as const };
}

export async function approveAutobusRequest(formData: FormData) {
  const requestId = Number(formData.get("request_id"));
  const force = formData.get("force") === "1";
  if (!requestId) {
    return { ok: false as const, error: "Хүсэлтийн ID байхгүй" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_autobus_request", {
    p_request_id: requestId,
    p_force: force,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/eelj");
  return { ok: true as const };
}

export async function rejectAutobusRequest(formData: FormData) {
  const requestId = Number(formData.get("request_id"));
  const reason = (formData.get("reason") as string) || null;
  if (!requestId) {
    return { ok: false as const, error: "Хүсэлтийн ID байхгүй" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_autobus_request", {
    p_request_id: requestId,
    p_reason: reason,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/eelj");
  return { ok: true as const };
}

// Thin void wrappers for Server Component <form action={...}> usage
export async function approveAutobusRequestForm(
  formData: FormData,
): Promise<void> {
  await approveAutobusRequest(formData);
}

export async function rejectAutobusRequestForm(
  formData: FormData,
): Promise<void> {
  await rejectAutobusRequest(formData);
}

export async function requestAutobusSeatForm(
  formData: FormData,
): Promise<void> {
  await requestAutobusSeat(formData);
}

const getMyEeljCardsCached = cache(async (): Promise<EeljCard[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_eelj_cards");
  if (error) {
    console.error("[eelj] get_my_eelj_cards failed:", error.message);
    return [];
  }
  return ((data as unknown[]) ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      eeljId: Number(r.eelj_id),
      eeljName: String(r.eelj_name ?? ""),
      dayDate: String(r.day_date),
      isCome: Boolean(r.is_come),
      autobusId: Number(r.autobus_id),
      autobusNumber: String(r.autobus_number ?? ""),
      directionName: (r.direction_name as string) ?? null,
      driverName: (r.driver_name as string) ?? null,
      driverPhone: (r.driver_phone as string) ?? null,
      leaderName: (r.leader_name as string) ?? null,
      zamTsag: r.zam_tsag != null ? Number(r.zam_tsag) : null,
      zamTsagDayDate: (r.zam_tsag_day_date as string) ?? null,
      isMyAssignment: Boolean(r.is_my_assignment),
      requestId: r.request_id != null ? Number(r.request_id) : null,
      requestStatus: (r.request_status as EeljRequestStatus | null) ?? null,
      requestDecisionReason: (r.request_decision_reason as string) ?? null,
    };
  });
});

export async function getMyEeljCards() {
  return getMyEeljCardsCached();
}
