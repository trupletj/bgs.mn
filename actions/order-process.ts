"use server";

import { createClient } from "@/utils/supabase/client";
import { revalidatePath } from "next/cache";
import { getProfileIdFromAuthUserId } from "./review";

export interface OrderProcessFormData {
  name: string;
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
  is_deleted: any;
  created_at: string | number | Date;
  id: number;
  name: string;
  steps: Array<{
    required_approval_count: any;
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
}

export async function createOrderProcess(
  formData: OrderProcessFormData,
): Promise<OrderProcessResult> {
  const supabase = createClient();

  try {
    const { data: process, error: processError } = await supabase
      .from("order_processes")
      .insert({ name: formData.name })
      .select("id")
      .single();

    if (processError) throw processError;

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
  const supabase = createClient();

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
  const supabase = createClient();

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
    };
  } catch (error) {
    console.error("Error fetching order process:", error);
    return null;
  }
}

export async function getOrderProcesses() {
  const supabase = createClient();

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

export async function deleteOrderProcess(
  id: number,
): Promise<OrderProcessResult> {
  const supabase = createClient();

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
  const supabase = createClient();

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
