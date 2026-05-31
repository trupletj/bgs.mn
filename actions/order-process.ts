"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getProfileIdFromAuthUserId } from "./profile";

export interface OrderProcessFormData {
  name: string;
  allowed_heltes_ids: string[];
  purchase_role_ids: number[];
  steps: Array<{
    step_order: number;
    step_name: string;
    role_ids: number[];
    required_approval_count: number;
  }>;
}

interface OrderProcessResult {
  success: boolean;
  id?: number;
  error?: string;
}

interface Step {
  id: number;
  step_order: number;
  step_name: string;
  required_approval_count: number;
  order_step_roles: Array<{
    role_id: number;
    roles: {
      id: number;
      name: string;
      display_name: string;
    };
  }>;
}

interface OrderProcess {
  is_deleted: boolean | null;
  created_at: string | number | Date;
  id: number;
  name: string;
  steps: Array<{
    required_approval_count: number;
    id: number;
    step_order: number;
    step_name: string;
    role_ids: number[];
    roles: Array<{
      id: number;
      name: string;
      display_name: string;
    }>;
  }>;
  allowed_heltes_ids: string[];
  purchase_role_ids: number[];
}

export interface OrderProcessOption {
  id: string;
  name: string;
}

interface RoleNameRow {
  roles?: { name?: string | null } | null;
}

interface RoleAccessRow extends RoleNameRow {
  role_id: number | string | null;
}

interface NestedOrderProcessRow {
  order_processes:
    | {
        id: number;
        name: string;
      }
    | {
        id: number;
        name: string;
      }[]
    | null;
}

const PURCHASE_ALLOWED_ORDER_STATUSES = ["approved", "changes_requested"];

export async function createOrderProcess(
  formData: OrderProcessFormData,
): Promise<OrderProcessResult> {
  const supabase = await createClient();

  try {
    const { data: process, error: processError } = await supabase
      .from("order_processes")
      .insert({ name: formData.name })
      .select("id")
      .single();

    if (processError) throw processError;

    await saveOrderProcessAccess({
      processId: process.id,
      allowedHeltesIds: formData.allowed_heltes_ids,
      purchaseRoleIds: formData.purchase_role_ids,
    });

    for (const step of formData.steps) {
      const { data: stepData, error: stepError } = await supabase
        .from("order_steps")
        .insert({
          order_process_id: process.id,
          step_order: step.step_order,
          step_name: step.step_name,
          required_approval_count: step.required_approval_count,
        })
        .select("id")
        .single();

      if (stepError) throw stepError;

      if (step.role_ids.length > 0) {
        const roleInserts = step.role_ids.map((role_id) => ({
          order_step_id: stepData.id,
          role_id,
        }));

        const { error: rolesError } = await supabase
          .from("order_step_roles")
          .insert(roleInserts);

        if (rolesError) throw rolesError;
      }
    }

    revalidatePath("/order-processes");
    return { success: true, id: process.id };
  } catch (error) {
    console.error("Error creating order process:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updateOrderProcess(
  id: number,
  formData: OrderProcessFormData,
): Promise<OrderProcessResult> {
  const supabase = await createClient();

  try {
    /* -------------------------------------------------
     1. Active order байгаа эсэхийг шалгах
    ------------------------------------------------- */
    const { count } = await supabase
      .from("order_instances")
      .select("*", { count: "exact", head: true })
      .eq("order_process_id", id)
      .in("status", ["pending", "in_progress"]);

    if (count && count > 0) {
      return {
        success: false,
        error: "Идэвхтэй захиалга байгаа тул процесс засах боломжгүй",
      };
    }

    /* -------------------------------------------------
     2. Order process нэр шинэчлэх
    ------------------------------------------------- */
    const { error: processError } = await supabase
      .from("order_processes")
      .update({ name: formData.name })
      .eq("id", id);

    if (processError) throw processError;

    await saveOrderProcessAccess({
      processId: id,
      allowedHeltesIds: formData.allowed_heltes_ids,
      purchaseRoleIds: formData.purchase_role_ids,
    });

    /* -------------------------------------------------
     3. Хуучин steps + roles устгах
    ------------------------------------------------- */
    const { data: steps, error: stepsError } = await supabase
      .from("order_steps")
      .select("id")
      .eq("order_process_id", id);

    if (stepsError) throw stepsError;

    if (steps && steps.length > 0) {
      const stepIds = steps.map((s) => s.id);

      // step roles
      await supabase
        .from("order_step_roles")
        .delete()
        .in("order_step_id", stepIds);

      // steps
      await supabase.from("order_steps").delete().eq("order_process_id", id);
    }

    /* -------------------------------------------------
     4. Шинэ steps + roles үүсгэх
    ------------------------------------------------- */
    for (const step of formData.steps) {
      const { data: newStep, error: stepError } = await supabase
        .from("order_steps")
        .insert({
          order_process_id: id,
          step_order: step.step_order,
          step_name: step.step_name,
          required_approval_count: step.required_approval_count || 1,
        })
        .select("id")
        .single();

      if (stepError) throw stepError;

      if (step.role_ids.length > 0) {
        const roleRows = step.role_ids.map((role_id) => ({
          order_step_id: newStep.id,
          role_id,
        }));

        const { error: roleError } = await supabase
          .from("order_step_roles")
          .insert(roleRows);

        if (roleError) throw roleError;
      }
    }

    revalidatePath("/order-processes");
    revalidatePath(`/order-processes/${id}/edit`);

    return { success: true };
  } catch (error) {
    console.error("Error updating order process:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getOrderProcess(
  id: number,
): Promise<OrderProcess | null> {
  const supabase = await createClient();

  try {
    const { data: process, error: processError } = await supabase
      .from("order_processes")
      .select("*")
      .eq("id", id)
      .single();

    if (processError) throw processError;

    const { data: stepsData, error: stepsError } = await supabase
      .from("order_steps")
      .select(
        `
        id,
        step_order,
        step_name,
        required_approval_count,
        order_step_roles (
          role_id,
          roles (
            id,
            name,
            display_name
          )
        )
      `,
      )
      .eq("order_process_id", id)
      .order("step_order");

    if (stepsError) throw stepsError;

    const [{ data: heltesRows, error: heltesError }, { data: purchaseRoleRows, error: purchaseRoleError }] =
      await Promise.all([
        supabase
          .from("order_process_allowed_heltes")
          .select("heltes_bteg_id")
          .eq("order_process_id", id),
        supabase
          .from("order_process_purchase_roles")
          .select("role_id")
          .eq("order_process_id", id),
      ]);

    if (heltesError) throw heltesError;
    if (purchaseRoleError) throw purchaseRoleError;

    const steps = (stepsData as unknown as Step[]).map((step) => ({
      id: step.id,
      step_order: step.step_order,
      step_name: step.step_name,
      required_approval_count: step.required_approval_count,
      role_ids: step.order_step_roles.map((r) => r.role_id),
      roles: step.order_step_roles.map((r) => r.roles),
    }));

    return {
      ...process,
      steps,
      allowed_heltes_ids: (heltesRows ?? []).map((row) => row.heltes_bteg_id),
      purchase_role_ids: (purchaseRoleRows ?? []).map((row) => row.role_id),
    };
  } catch (error) {
    console.error("Error fetching order process:", error);
    return null;
  }
}

async function saveOrderProcessAccess({
  processId,
  allowedHeltesIds,
  purchaseRoleIds,
}: {
  processId: number;
  allowedHeltesIds: string[];
  purchaseRoleIds: number[];
}) {
  const supabase = await createClient();

  const [{ error: deleteHeltesError }, { error: deleteRolesError }] =
    await Promise.all([
      supabase
        .from("order_process_allowed_heltes")
        .delete()
        .eq("order_process_id", processId),
      supabase
        .from("order_process_purchase_roles")
        .delete()
        .eq("order_process_id", processId),
    ]);

  if (deleteHeltesError) throw deleteHeltesError;
  if (deleteRolesError) throw deleteRolesError;

  if (allowedHeltesIds.length > 0) {
    const { error } = await supabase.from("order_process_allowed_heltes").insert(
      allowedHeltesIds.map((heltes_bteg_id) => ({
        order_process_id: processId,
        heltes_bteg_id,
      })),
    );
    if (error) throw error;
  }

  if (purchaseRoleIds.length > 0) {
    const { error } = await supabase.from("order_process_purchase_roles").insert(
      purchaseRoleIds.map((role_id) => ({
        order_process_id: processId,
        role_id,
      })),
    );
    if (error) throw error;
  }
}

export async function getOrderProcesses() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("order_processes")
      .select("*")
      .neq("is_deleted", true);

    if (error) {
      throw new Error(
        error.message + "захиалгын төрлүүдийг татах үед алдаа гарлаа",
      );
    }

    if (!data || data.length === 0) {
      return { success: false, message: "No order processes found", data: [] };
    }

    return data;
  } catch (error) {
    console.error("Error fetching order processes:", error);
  }
}

export async function getOrderProcessesForCurrentUser(): Promise<OrderProcessOption[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const [{ data: roleRows }, { data: userProfile }] = await Promise.all([
    supabase
      .from("profile")
      .select("id, roles_profiles(roles(name))")
      .eq("auth_user_id", user.id)
      .single(),
    supabase
      .from("users")
      .select("heltes_id")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
  ]);

  const roleProfileRows = (roleRows?.roles_profiles ?? []) as RoleNameRow[];
  const roles = roleProfileRows
    .map((row) => row.roles?.name)
    .filter((name): name is string => Boolean(name));

  if (roles.includes("super_admin")) {
    const data = await getOrderProcesses();
    const processes = Array.isArray(data) ? data : data?.data ?? [];
    return processes.map((process: { id: number | string; name: string }) => ({
      id: String(process.id),
      name: process.name,
    }));
  }

  if (!userProfile?.heltes_id) return [];

  const { data, error } = await supabase
    .from("order_process_allowed_heltes")
    .select(
      `
      order_processes!inner (
        id,
        name,
        is_deleted
      )
    `,
    )
    .eq("heltes_bteg_id", userProfile.heltes_id)
    .eq("order_processes.is_deleted", false);

  if (error) {
    console.error("Error fetching available order processes:", error);
    return [];
  }

  return ((data ?? []) as NestedOrderProcessRow[])
    .map((row) =>
      Array.isArray(row.order_processes)
        ? row.order_processes[0]
        : row.order_processes
    )
    .filter((process): process is { id: number; name: string } =>
      Boolean(process)
    )
    .map((process) => ({
      id: String(process.id),
      name: process.name,
    }));
}

export async function getPurchaseAllowedProcessIdsForCurrentUser(): Promise<{
  isSuperAdmin: boolean;
  processIds: number[];
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { isSuperAdmin: false, processIds: [] };

  const { data: profile } = await supabase
    .from("profile")
    .select("id, roles_profiles(role_id, roles(name))")
    .eq("auth_user_id", user.id)
    .single();

  const roleRows = (profile?.roles_profiles ?? []) as RoleAccessRow[];
  const roleNames = roleRows.map((row) => row.roles?.name).filter(Boolean);

  if (roleNames.includes("super_admin")) {
    return { isSuperAdmin: true, processIds: [] };
  }

  const roleIds = roleRows
    .map((row) => Number(row.role_id))
    .filter((id) => Number.isFinite(id));

  if (roleIds.length === 0) return { isSuperAdmin: false, processIds: [] };

  const { data, error } = await supabase
    .from("order_process_purchase_roles")
    .select("order_process_id")
    .in("role_id", roleIds);

  if (error) {
    console.error("Error fetching purchase process access:", error);
    return { isSuperAdmin: false, processIds: [] };
  }

  return {
    isSuperAdmin: false,
    processIds: Array.from(
      new Set((data ?? []).map((row) => Number(row.order_process_id))),
    ),
  };
}

export async function deleteOrderProcess(
  id: number,
): Promise<OrderProcessResult> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("order_processes")
      .update({ is_deleted: true })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/order-processes");
    return { success: true };
  } catch (error) {
    console.error("Error deleting order process:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updateOrderManagementStatus({
  orderId,
  newStatus,
  reason,
  currentOrderStatus,
  currentManagementStatus,
}: {
  orderId: string;
  newStatus: string;
  reason?: string;
  currentOrderStatus?: string | null;
  currentManagementStatus?: string | null;
}) {
  const supabase = await createClient();

  const profileId = await getProfileIdFromAuthUserId();

  const oldStatus = currentManagementStatus ?? currentOrderStatus;

  if (!oldStatus) {
    throw new Error("Өмнөх статус тодорхойгүй байна");
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({ management_status: newStatus })
    .eq("id", orderId);

  if (orderError) throw orderError;

  const { error: historyError } = await supabase
    .from("order_status_history")
    .insert({
      order_id: orderId,
      old_status: oldStatus,
      new_status: newStatus,
      reason: reason?.trim() || null,
      changed_by: profileId,
    });

  if (historyError) throw historyError;

  return { success: true };
}

export async function updateFulfillmentStatus({
  fulfillmentId,
  newStatus,
  oldStatus,
  reason,
}: {
  fulfillmentId: string;
  newStatus: string;
  oldStatus: string;
  reason?: string;
}) {
  const supabase = await createClient();
  await assertCanAccessFulfillmentPurchase(fulfillmentId);
  const profileId = await getProfileIdFromAuthUserId();

  const { error: updateError } = await supabase
    .from("order_fulfillment")
    .update({ status: newStatus })
    .eq("id", fulfillmentId);

  if (updateError) throw updateError;

  const { error: historyError } = await supabase
    .from("fulfillment_status_history")
    .insert({
      fulfillment_id: fulfillmentId,
      old_status: oldStatus,
      new_status: newStatus,
      reason: reason,
      changed_by: profileId,
    });

  if (historyError) throw historyError;

  return { success: true };
}

export async function getOrderItemsForOrderProcess(orderId: string) {
  const supabase = await createClient();
  await assertCanAccessOrderPurchase(Number(orderId));

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("title, requested_delivery_date")
    .eq("id", orderId)
    .single();

  if (orderError) {
    console.error(orderError);
    throw new Error("Захиалгын мэдээлэл татахад алдаа гарлаа");
  }

  const { data, error } = await supabase
    .from("order_items")
    .select(
      `
      *,
      order_fulfillment (
        id,
        quantity,
        status,
        created_at,
        notes,
        fulfillment_status_history (
          id,
          old_status,
          new_status,
          reason,
          created_at,
          changed_by
        )
      )
    `,
    )
    .eq("order_id", orderId)
    .order("id");

  if (error) {
    console.error(error);
    throw new Error("Өгөгдөл татахад алдаа гарлаа");
  }

  return (data || []).map((item) => ({
    ...item,
    order_title: order?.title ?? null,
    order_requested_delivery_date: order?.requested_delivery_date ?? null,
  }));
}

export async function assertCanAccessOrderPurchase(orderId: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("order_process_id, status")
    .eq("id", orderId)
    .single();

  if (error || !data?.order_process_id) {
    throw new Error("Захиалга олдсонгүй");
  }

  if (!PURCHASE_ALLOWED_ORDER_STATUSES.includes(String(data.status))) {
    throw new Error(
      "Батлагдаагүй захиалгын худалдан авалт, биелэлт рүү хандах боломжгүй",
    );
  }

  const { isSuperAdmin, processIds } =
    await getPurchaseAllowedProcessIdsForCurrentUser();

  if (isSuperAdmin) return;
  if (processIds.length === 0) {
    throw new Error("Энэ захиалгын биелэлтийг харах эрхгүй байна");
  }

  if (!processIds.includes(Number(data.order_process_id))) {
    throw new Error("Энэ захиалгын биелэлтийг харах эрхгүй байна");
  }
}

export async function assertCanAccessOrderItemPurchase(orderItemId: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("order_items")
    .select("order_id")
    .eq("id", orderItemId)
    .single();

  if (error || !data?.order_id) {
    throw new Error("Захиалгын мөр олдсонгүй");
  }

  await assertCanAccessOrderPurchase(Number(data.order_id));
}

async function assertCanAccessFulfillmentPurchase(fulfillmentId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("order_fulfillment")
    .select("order_items(order_id)")
    .eq("id", fulfillmentId)
    .single();

  const orderItems = Array.isArray(data?.order_items)
    ? data?.order_items[0]
    : data?.order_items;

  if (error || !orderItems?.order_id) {
    throw new Error("Биелэлт олдсонгүй");
  }

  await assertCanAccessOrderPurchase(Number(orderItems.order_id));
}
