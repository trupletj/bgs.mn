"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getProfileIdFromAuthUserId } from "./profile";
import type { DeviceType, DeviceStatus, DeviceSpecs } from "@/types/device";

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
      organization_id, heltes_id, alba_id, created_at, specs,
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

export async function getOrgStructureForDevices() {
  const supabase = await createClient();

  const [{ data: orgs }, { data: heltesList }, { data: albaList }] = await Promise.all([
    supabase.from("organization").select("id, name").eq("is_active", true).order("name"),
    supabase.from("heltes").select("id, name, organization:organization_id ( id )").eq("is_active", true).order("name"),
    supabase.from("alba").select("id, name, heltes:heltes_id ( id ), organization:organization_id ( id )").eq("is_active", true).order("name"),
  ]);

  return {
    organizations: (orgs ?? []) as { id: string; name: string }[],
    heltes: (heltesList ?? []).map((h: any) => ({
      id: h.id as string,
      name: h.name as string,
      organization_id: (h.organization?.id ?? null) as string | null,
    })),
    alba: (albaList ?? []).map((a: any) => ({
      id: a.id as string,
      name: a.name as string,
      heltes_id: (a.heltes?.id ?? null) as string | null,
      organization_id: (a.organization?.id ?? null) as string | null,
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
      )
    `)
    .eq("id", id)
    .single();

  return { data, error };
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
      created_by: profileId ? Number(profileId) : null,
    })
    .select("id")
    .single();

  if (error || !device) throw new Error(error?.message ?? "Бүртгэл үүсгэж чадсангүй");

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
