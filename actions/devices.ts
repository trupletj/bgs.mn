"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getProfileIdFromAuthUserId } from "./profile";
import type { DeviceType, DeviceStatus, DeviceSpecs } from "@/types/device";

// ─── User search ──────────────────────────────────────────────────────────────

export async function searchAssignableUsers(query: string) {
  const supabase = await createClient();
  const parts = query.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [];

  let q = supabase
    .from("users")
    .select("id, first_name, last_name, position_name, department_name")
    .eq("is_active", true)
    .limit(10);

  // Хэрэв хэд хэдэн үг байвал тус бүрийг ovog/ner-т хайна (AND шүүлт)
  for (const part of parts) {
    q = q.or(`first_name.ilike.%${part}%,last_name.ilike.%${part}%`);
  }

  const { data } = await q.order("last_name");
  return (data ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    position_name?: string;
    department_name?: string;
  }[];
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getDevices(filters?: {
  type?: DeviceType;
  status?: DeviceStatus;
  search?: string;
  org_id?: string;
  heltes_id?: string;
  alba_id?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("devices")
    .select(`
      id, name, model, serial_number, manufacturer, device_type, status,
      location, purchase_date, warranty_expiry_date, department_name, heltes_name,
      organization_id, heltes_id, alba_id, paired_with_device_id, created_at, specs,
      organization:organization_id ( id, name ),
      heltes!devices_heltes_id_fkey ( id, name ),
      alba!devices_alba_id_fkey ( id, name ),
      device_assignments ( id, is_primary, user_id,
        user:user_id ( id, first_name, last_name, position_name )
      )
    `)
    .order("created_at", { ascending: false });

  if (filters?.type)      query = query.eq("device_type", filters.type);
  if (filters?.status)    query = query.eq("status", filters.status);
  if (filters?.org_id)    query = query.eq("organization_id", filters.org_id);
  if (filters?.heltes_id) query = query.eq("heltes_id", filters.heltes_id);
  if (filters?.alba_id)   query = query.eq("alba_id", filters.alba_id);
  if (filters?.search)    query = query.or(`name.ilike.%${filters.search}%,model.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`);

  const { data, error } = await query;
  return { data: data ?? [], error };
}

const ALLOWED_ORG_BTEG_IDS = ["1", "2", "10", "20"];

export async function getOrgStructureForDevices() {
  const supabase = await createClient();

  const [{ data: orgs }, { data: heltesList }, { data: albaList }] = await Promise.all([
    supabase.from("organization").select("id, name, bteg_id").eq("is_active", true).in("bteg_id", ALLOWED_ORG_BTEG_IDS).order("name"),
    supabase.from("heltes").select("id, name, bteg_id, organization_id").eq("is_active", true).in("organization_id", ALLOWED_ORG_BTEG_IDS).order("name"),
    supabase.from("alba").select("id, name, bteg_id, organization_id, heltes_id").eq("is_active", true).in("organization_id", ALLOWED_ORG_BTEG_IDS).order("name"),
  ]);

  return {
    organizations: (orgs ?? []).map((o: any) => ({
      id: o.id as string,
      name: o.name as string,
      bteg_id: (o.bteg_id ?? "") as string,
    })),
    heltes: (heltesList ?? []).map((h: any) => ({
      id: h.id as string,
      name: h.name as string,
      bteg_id: (h.bteg_id ?? "") as string,
      org_bteg_id: (h.organization_id ?? null) as string | null,
    })),
    alba: (albaList ?? []).map((a: any) => ({
      id: a.id as string,
      name: a.name as string,
      bteg_id: (a.bteg_id ?? "") as string,
      heltes_bteg_id: (a.heltes_id ?? null) as string | null,
      org_bteg_id: (a.organization_id ?? null) as string | null,
    })),
  };
}

export async function getDevice(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("devices")
    .select(`
      *,
      organization:organization_id ( id, name ),
      heltes!devices_heltes_id_fkey ( id, name ),
      alba!devices_alba_id_fkey ( id, name ),
      device_assignments (
        id, is_primary, assigned_at, notes, user_id,
        user:user_id ( id, first_name, last_name, position_name, department_name, phone )
      ),
      paired_with:paired_with_device_id ( id, name, model, serial_number, device_type )
    `)
    .eq("id", id)
    .single();

  if (data) {
    const { data: paired_monitors } = await supabase
      .from("devices")
      .select("id, name, model, serial_number, device_type")
      .eq("paired_with_device_id", id)
      .order("name");
    (data as any).paired_monitors = paired_monitors ?? [];
  }

  return { data, error };
}

export async function searchDevicesForPairing(opts: {
  query?: string;
  types: string[];
  excludeId?: string;
  unpairedOnly?: boolean;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("devices")
    .select("id, name, model, serial_number, device_type, paired_with_device_id")
    .in("device_type", opts.types)
    .limit(20);
  if (opts.excludeId) q = q.neq("id", opts.excludeId);
  if (opts.query?.trim()) {
    q = q.or(`name.ilike.%${opts.query}%,model.ilike.%${opts.query}%,serial_number.ilike.%${opts.query}%`);
  }
  if (opts.unpairedOnly) q = q.is("paired_with_device_id", null);
  const { data } = await q.order("name");
  return (data ?? []) as { id: string; name: string; model?: string; serial_number?: string; device_type: string; paired_with_device_id?: string | null }[];
}

export async function createPairedMonitors(
  computerId: string,
  monitors: { name: string; model?: string; serial_number?: string; manufacturer?: string; size_inch?: number }[]
) {
  if (!monitors.length) return [];
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();

  // Inherit org/heltes/alba from the parent computer so the new monitor
  // is automatically scoped under the same department.
  const { data: parent } = await supabase
    .from("devices")
    .select("organization_id, heltes_id, alba_id, department_name, heltes_name, location")
    .eq("id", computerId)
    .single();

  const rows = monitors.map(m => ({
    name: m.name.trim(),
    model: m.model?.trim() || null,
    serial_number: m.serial_number?.trim() || null,
    manufacturer: m.manufacturer?.trim() || null,
    device_type: "monitor",
    status: "active",
    location: parent?.location ?? null,
    organization_id: parent?.organization_id ?? null,
    heltes_id: parent?.heltes_id ?? null,
    alba_id: parent?.alba_id ?? null,
    department_name: parent?.department_name ?? null,
    heltes_name: parent?.heltes_name ?? null,
    paired_with_device_id: computerId,
    specs: m.size_inch ? { size_inch: m.size_inch } : {},
    created_by: profileId ? Number(profileId) : null,
  }));

  const { data, error } = await supabase.from("devices").insert(rows).select("id");
  if (error) throw new Error(error.message);

  for (const d of data ?? []) {
    await supabase.from("device_history").insert({
      device_id: d.id, action_type: "created",
      description: "Компьютертэй хамт бүртгэгдлээ",
      changed_by: profileId ? Number(profileId) : null,
    });
  }
  revalidatePath(`/devices/${computerId}`);
  revalidatePath("/devices");
  return (data ?? []).map(d => d.id as string);
}

export async function setMonitorPairings(computerId: string, monitorIds: string[]) {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();

  // Current monitors paired with this computer
  const { data: current } = await supabase
    .from("devices")
    .select("id")
    .eq("paired_with_device_id", computerId);
  const currentIds = new Set((current ?? []).map((d: any) => d.id));
  const targetIds  = new Set(monitorIds);

  const toUnpair = [...currentIds].filter(id => !targetIds.has(id));
  const toPair   = [...targetIds].filter(id => !currentIds.has(id));

  if (toUnpair.length) {
    await supabase.from("devices").update({ paired_with_device_id: null }).in("id", toUnpair);
    for (const id of toUnpair) {
      await supabase.from("device_history").insert({
        device_id: id, action_type: "unpaired",
        description: "Компьютероос салгагдлаа", changed_by: profileId ? Number(profileId) : null,
      });
    }
  }
  if (toPair.length) {
    await supabase.from("devices").update({ paired_with_device_id: computerId }).in("id", toPair);
    for (const id of toPair) {
      await supabase.from("device_history").insert({
        device_id: id, action_type: "paired",
        description: "Компьютертэй холбогдлоо", changed_by: profileId ? Number(profileId) : null,
      });
    }
  }
  revalidatePath(`/devices/${computerId}`);
}

export async function getDeviceHistory(deviceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("device_history")
    .select("*, profile:changed_by ( name )")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false });
  return { data: data ?? [], error };
}

export async function getDeviceMaintenance(deviceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("device_maintenance")
    .select("*, profile:created_by ( name )")
    .eq("device_id", deviceId)
    .order("maintenance_date", { ascending: false });
  return { data: data ?? [], error };
}

export async function getDeviceReportByDepartment() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devices")
    .select(`
      id, device_type, status, department_name, heltes_name,
      organization:organization_id ( id, name ),
      heltes!devices_heltes_id_fkey ( id, name ),
      alba!devices_alba_id_fkey ( id, name )
    `);
  return { data: data ?? [], error };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createDevice(input: {
  name: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  device_type: DeviceType;
  status: DeviceStatus;
  location?: string;
  purchase_date?: string;
  warranty_expiry_date?: string;
  notes?: string;
  specs?: DeviceSpecs;
  organization_id?: string;
  heltes_id?: string;
  alba_id?: string;
  department_name?: string;
  heltes_name?: string;
  user_ids?: string[];
  paired_with_device_id?: string | null;
  paired_monitor_ids?: string[];
}) {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();

  const { data: device, error } = await supabase
    .from("devices")
    .insert({
      name: input.name,
      model: input.model || null,
      serial_number: input.serial_number || null,
      manufacturer: input.manufacturer || null,
      device_type: input.device_type,
      status: input.status,
      location: input.location || null,
      purchase_date: input.purchase_date || null,
      warranty_expiry_date: input.warranty_expiry_date || null,
      notes: input.notes || null,
      specs: input.specs ?? {},
      organization_id: input.organization_id || null,
      heltes_id: input.heltes_id || null,
      alba_id: input.alba_id || null,
      department_name: input.department_name || null,
      heltes_name: input.heltes_name || null,
      paired_with_device_id: input.paired_with_device_id || null,
      created_by: profileId ? Number(profileId) : null,
    })
    .select("id")
    .single();

  if (error || !device) throw new Error(error?.message ?? "Бүртгэл үүсгэж чадсангүй");

  // Pair monitors to this newly-created computer
  if (input.paired_monitor_ids?.length) {
    await supabase
      .from("devices")
      .update({ paired_with_device_id: device.id })
      .in("id", input.paired_monitor_ids);
  }

  // Add assignments
  if (input.user_ids?.length) {
    await supabase.from("device_assignments").insert(
      input.user_ids.map((uid, i) => ({
        device_id: device.id,
        user_id: uid,
        is_primary: i === 0,
      }))
    );
  }

  // History
  await supabase.from("device_history").insert({
    device_id: device.id,
    action_type: "created",
    description: "Тоног төхөөрөмж бүртгэгдлээ",
    changed_by: profileId ? Number(profileId) : null,
  });

  revalidatePath("/devices");
  return device.id;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateDevice(
  id: string,
  input: {
    name?: string;
    model?: string;
    serial_number?: string;
    manufacturer?: string;
    status?: DeviceStatus;
    location?: string;
    purchase_date?: string;
    warranty_expiry_date?: string;
    notes?: string;
    specs?: DeviceSpecs;
    organization_id?: string | null;
    heltes_id?: string | null;
    alba_id?: string | null;
    department_name?: string;
    heltes_name?: string;
    paired_with_device_id?: string | null;
  },
  changeDescription?: string
) {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();

  const { error } = await supabase.from("devices").update(input).eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("device_history").insert({
    device_id: id,
    action_type: "updated",
    description: changeDescription ?? "Мэдээлэл шинэчлэгдлээ",
    changed_by: profileId ? Number(profileId) : null,
  });

  revalidatePath(`/devices/${id}`);
  revalidatePath("/devices");
}

// ─── Status change ────────────────────────────────────────────────────────────

export async function changeDeviceStatus(
  id: string,
  newStatus: DeviceStatus,
  oldStatus: DeviceStatus,
  description: string
) {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();

  const { error } = await supabase.from("devices").update({ status: newStatus }).eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("device_history").insert({
    device_id: id,
    action_type: "status_changed",
    description,
    old_value: oldStatus,
    new_value: newStatus,
    changed_by: profileId ? Number(profileId) : null,
  });

  revalidatePath(`/devices/${id}`);
  revalidatePath("/devices");
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export async function addDeviceAssignment(
  deviceId: string,
  userId: string,
  notes?: string
) {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();

  const { error } = await supabase.from("device_assignments").insert({
    device_id: deviceId,
    user_id: userId,
    notes: notes || null,
  });
  if (error) throw new Error(error.message);

  await supabase.from("device_history").insert({
    device_id: deviceId,
    action_type: "assigned",
    description: `Хариуцагч нэмэгдлээ`,
    changed_by: profileId ? Number(profileId) : null,
  });

  revalidatePath(`/devices/${deviceId}`);
}

export async function removeDeviceAssignment(deviceId: string, assignmentId: string) {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();

  const { error } = await supabase.from("device_assignments").delete().eq("id", assignmentId);
  if (error) throw new Error(error.message);

  await supabase.from("device_history").insert({
    device_id: deviceId,
    action_type: "unassigned",
    description: "Хариуцагч хасагдлаа",
    changed_by: profileId ? Number(profileId) : null,
  });

  revalidatePath(`/devices/${deviceId}`);
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

export async function addDeviceMaintenance(input: {
  device_id: string;
  maintenance_date: string;
  description: string;
  technician?: string;
  status: "completed" | "ongoing";
}) {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();

  const { error } = await supabase.from("device_maintenance").insert({
    ...input,
    created_by: profileId ? Number(profileId) : null,
  });
  if (error) throw new Error(error.message);

  await supabase.from("device_history").insert({
    device_id: input.device_id,
    action_type: "maintenance",
    description: `Засварын бүртгэл нэмэгдлээ: ${input.description}`,
    changed_by: profileId ? Number(profileId) : null,
  });

  revalidatePath(`/devices/${input.device_id}`);
}

export async function deleteDeviceMaintenance(deviceId: string, maintenanceId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("device_maintenance").delete().eq("id", maintenanceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/devices/${deviceId}`);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteDevice(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("devices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/devices");
}

// ─── Device Requests ──────────────────────────────────────────────────────────

export type DeviceRequestType = "new" | "replace" | "transfer" | "decommission" | "repair";
export type DeviceRequestPriority = "urgent" | "normal" | "low";
export type DeviceRequestStatus = "pending" | "approved" | "rejected";

export interface DeviceRequestInput {
  req_org_bteg?: string;
  req_heltes_bteg?: string;
  req_alba_bteg?: string;
  request_type: DeviceRequestType;
  device_type?: string;
  specs?: Record<string, unknown>;
  purpose?: string;
  notes?: string;
  priority?: DeviceRequestPriority;
  assigned_to?: number | null;
  fulfilled_by_request_id?: string | null;
  parent_request_id?: string | null;
  old_device_id?: string;
  transfer_old?: boolean;
  transfer_to_org_bteg?: string;
  transfer_to_heltes_bteg?: string;
  transfer_to_alba_bteg?: string;
  transfer_to_user_id?: string;
}

export async function createDeviceRequest(input: DeviceRequestInput) {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();

  const { data, error } = await supabase
    .from("device_requests")
    .insert({
      ...input,
      transfer_old: input.transfer_old ?? false,
      specs: input.specs ?? {},
      old_device_id: input.old_device_id || null,
      transfer_to_user_id: input.transfer_to_user_id || null,
      assigned_to: input.assigned_to ?? null,
      fulfilled_by_request_id: input.fulfilled_by_request_id ?? null,
      parent_request_id: input.parent_request_id ?? null,
      priority: input.priority ?? "normal",
      created_by: profileId ? Number(profileId) : null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("device_request_status_history").insert({
    request_id: data.id,
    from_status: null,
    to_status: "pending",
    note: "Хүсэлт үүсгэгдлээ",
    changed_by: profileId ? Number(profileId) : null,
  });

  revalidatePath("/devices/requests");
  return data.id as string;
}

export async function searchProfiles(query: string) {
  const supabase = await createClient();
  const parts = query.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  let q = supabase.from("profile").select("id, name, department_name, position_name").limit(10);
  for (const part of parts) {
    q = q.ilike("name", `%${part}%`);
  }
  const { data } = await q.order("name");
  return (data ?? []) as { id: number; name: string; department_name?: string; position_name?: string }[];
}

export async function getDeviceRequest(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("device_requests")
    .select(`
      *,
      old_device:old_device_id ( id, name, model, serial_number, device_type ),
      creator:created_by ( name, department_name, position_name ),
      assignee:assigned_to ( name, department_name, position_name ),
      fulfilled_by:fulfilled_by_request_id ( id, request_type, device_type, status )
    `)
    .eq("id", id)
    .single();
  return { data, error };
}

export async function getDeviceRequestComments(requestId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("device_request_comments")
    .select("id, body, created_at, author:created_by ( name )")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as { id: string; body: string; created_at: string; author?: { name: string } | null }[];
}

export async function addDeviceRequestComment(requestId: string, body: string) {
  if (!body.trim()) throw new Error("Утга оруулна уу");
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();
  const { error } = await supabase.from("device_request_comments").insert({
    request_id: requestId,
    body: body.trim(),
    created_by: profileId ? Number(profileId) : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/devices/requests/${requestId}/edit`);
}

export async function getDeviceRequestStatusHistory(requestId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("device_request_status_history")
    .select("id, from_status, to_status, note, created_at, changer:changed_by ( name )")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as {
    id: string; from_status: string | null; to_status: string;
    note: string | null; created_at: string; changer?: { name: string } | null;
  }[];
}

export async function getEligibleTargetRequests(deviceType?: string, excludeId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("device_requests")
    .select(`
      id, request_type, device_type, status, priority, purpose, specs, created_at,
      fulfilled_by_request_id,
      req_org_bteg, req_heltes_bteg, req_alba_bteg,
      creator:created_by ( name )
    `)
    .in("request_type", ["new", "replace"])
    .eq("status", "pending");
  if (deviceType) q = q.eq("device_type", deviceType);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.order("priority").order("created_at", { ascending: false });
  return ((data ?? []) as any[]).filter(r => !r.fulfilled_by_request_id);
}

export async function assignTransferToRequest(transferId: string, targetRequestId: string) {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();
  const { error } = await supabase
    .from("device_requests")
    .update({ fulfilled_by_request_id: transferId, updated_at: new Date().toISOString() })
    .eq("id", targetRequestId);
  if (error) throw new Error(error.message);

  await supabase.from("device_request_comments").insert({
    request_id: targetRequestId,
    body: "Шилжүүлэх хүсэлтэд холбогдлоо",
    created_by: profileId ? Number(profileId) : null,
  });

  revalidatePath("/devices/requests");
  revalidatePath(`/devices/requests/${transferId}/edit`);
  revalidatePath(`/devices/requests/${targetRequestId}/edit`);
}

export async function deleteDeviceRequest(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("device_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/devices/requests");
}

export async function unassignTransferFromRequest(targetRequestId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("device_requests")
    .update({ fulfilled_by_request_id: null, updated_at: new Date().toISOString() })
    .eq("id", targetRequestId);
  if (error) throw new Error(error.message);
  revalidatePath("/devices/requests");
  revalidatePath(`/devices/requests/${targetRequestId}/edit`);
}

export async function getEligibleTransferRequests(deviceType?: string, excludeId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("device_requests")
    .select(`
      id, request_type, device_type, status, priority, created_at,
      old_device:old_device_id ( id, name, model, serial_number, device_type ),
      transfer_to_org_bteg, transfer_to_heltes_bteg, transfer_to_alba_bteg,
      creator:created_by ( name )
    `)
    .eq("request_type", "transfer")
    .in("status", ["pending", "approved"]);
  if (deviceType) q = q.eq("device_type", deviceType);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as any[];
}

export async function searchITStaff(query: string) {
  const supabase = await createClient();
  const parts = query.trim().split(/\s+/).filter(Boolean);
  let q = supabase.from("profile").select("id, name, department_name, position_name").limit(15);
  for (const part of parts) {
    q = q.ilike("name", `%${part}%`);
  }
  const { data } = await q.order("name");
  return (data ?? []) as { id: number; name: string; department_name?: string; position_name?: string }[];
}

export async function getDeviceRequests() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("device_requests")
    .select(`
      *,
      old_device:old_device_id ( id, name, model, serial_number, device_type ),
      creator:created_by ( name ),
      assignee:assigned_to ( name )
    `)
    .order("created_at", { ascending: false });
  return { data: data ?? [], error };
}

export async function updateDeviceRequestStatus(
  id: string,
  status: "approved" | "rejected",
  admin_notes?: string
) {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();

  const { data: prev } = await supabase
    .from("device_requests")
    .select("status")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("device_requests")
    .update({ status, admin_notes: admin_notes || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("device_request_status_history").insert({
    request_id: id,
    from_status: prev?.status ?? null,
    to_status: status,
    note: admin_notes || null,
    changed_by: profileId ? Number(profileId) : null,
  });

  revalidatePath("/devices/requests");
  revalidatePath(`/devices/requests/${id}/edit`);
}

export async function updateDeviceRequest(
  id: string,
  input: Partial<DeviceRequestInput & { status: "pending" | "approved" | "rejected"; admin_notes: string; created_by: number | null }>
) {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();

  let prevStatus: string | null = null;
  if (input.status) {
    const { data: prev } = await supabase
      .from("device_requests")
      .select("status")
      .eq("id", id)
      .single();
    prevStatus = prev?.status ?? null;
  }

  const { error } = await supabase
    .from("device_requests")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (input.status && input.status !== prevStatus) {
    await supabase.from("device_request_status_history").insert({
      request_id: id,
      from_status: prevStatus,
      to_status: input.status,
      note: input.admin_notes || null,
      changed_by: profileId ? Number(profileId) : null,
    });
  }

  revalidatePath("/devices/requests");
  revalidatePath(`/devices/requests/${id}/edit`);
}

export async function getDevicesForRequest(filters: {
  org_bteg?: string;
  heltes_bteg?: string;
  alba_bteg?: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("devices")
    .select(`
      id, name, model, serial_number, device_type,
      organization:organization_id ( id, name, bteg_id ),
      heltes!devices_heltes_id_fkey ( id, name, bteg_id ),
      alba!devices_alba_id_fkey ( id, name, bteg_id )
    `)
    .order("name");

  return ((data ?? []) as any[]).filter(d => {
    if (filters.alba_bteg   && d.alba?.bteg_id   !== filters.alba_bteg)   return false;
    if (filters.heltes_bteg && d.heltes?.bteg_id !== filters.heltes_bteg) return false;
    if (filters.org_bteg    && d.organization?.bteg_id !== filters.org_bteg) return false;
    return true;
  }) as {
    id: string; name: string; model?: string; serial_number?: string; device_type: string;
    organization?: { id: string; name: string; bteg_id: string } | null;
    heltes?: { id: string; name: string; bteg_id: string } | null;
    alba?: { id: string; name: string; bteg_id: string } | null;
  }[];
}
