"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/utils/supabase/supabaseAdmin";
import { getProfileIdFromAuthUserId } from "./profile";
import { getOrderProcessesForCurrentUser } from "./order-process";
import { createClient } from "@/utils/supabase/server";
import { createClient as client } from "@/utils/supabase/client";

interface DetailReviewer {
  status?: string | null;
  reviewer_profile_id?: number | null;
  order_step_id?: number | null;
  order_steps?:
    | {
        step_order?: number | null;
        step_name?: string | null;
      }
    | Array<{
        step_order?: number | null;
        step_name?: string | null;
      }>
    | null;
  sub_order_items?: DetailSubOrderItem[];
}

interface DetailSubOrderItem {
  reviewer_profile_id?: number | null;
  order_step_id?: number | null;
}

function getReviewerStep(reviewer: DetailReviewer) {
  return Array.isArray(reviewer.order_steps)
    ? reviewer.order_steps[0]
    : reviewer.order_steps;
}

export async function getOrderWithDetail(orderId: string) {
  const supabase = client();

  // 1. Захиалга + үүсгэгч профайл
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      *,
      profile:created_profile (
        id,
        name,
        department_name,
        phone,
        position_name
      )
    `,
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return { data: null, error: orderError || new Error("Order not found") };
  }

  // 2. Order items
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select(
      "id, part_name, part_number, quantity, final_quantity, unit, spare_type",
    )
    .eq("order_id", orderId)
    .order("id");

  if (itemsError) console.error("Items error:", itemsError);

  // 3. Хамгийн сүүлийн instance + түүний бүх reviewer-ууд
  const { data: instances, error: instanceError } = await supabase
    .from("order_instances")
    .select(
      `
      id,
      status,
      current_step_order,
      completed_at,
      created_at,
      order_step_reviewers!order_step_reviewers_order_instance_id_fkey (
        id,
        status,
        reviewed_at,
        reviewer_profile_id,
        order_step_id,
        comment,
        profile:reviewer_profile_id (
          id,
          name,
          position_name,
          department_name
        ),
        order_steps!inner (
          id,
          step_order,
          step_name,
          required_approval_count
        )
      )
    `,
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (instanceError && instanceError.code !== "PGRST116") {
    console.error("Instance fetch error:", instanceError);
  }

  const latestInstance = instances?.[0];
  let reviewers: DetailReviewer[] =
    latestInstance?.order_step_reviewers?.filter(
      (r: DetailReviewer) => r.status !== "skipped",
    ) || [];

  // 4. Sub_order_item-үүдийг тусдаа авч, reviewer-т тааруулах
  if (latestInstance) {
    const { data: subItems, error: subError } = await supabase
      .from("sub_order_item")
      .select(
        `
        id,
        order_item_id,
        quantity,
        description,
        created_at,
        reviewer_profile_id,
        order_step_id
      `,
      )
      .eq("order_instance_id", latestInstance.id);

    if (subError) {
      console.error("Sub items error:", subError);
    } else if (subItems) {
      // Reviewer бүрт харьяалах sub_order_item-үүдийг нэмэх
      reviewers = reviewers.map((reviewer) => ({
        ...reviewer,
        sub_order_items: subItems.filter(
          (sub: DetailSubOrderItem) =>
            sub.reviewer_profile_id === reviewer.reviewer_profile_id &&
            sub.order_step_id === reviewer.order_step_id,
        ),
        step_order: getReviewerStep(reviewer)?.step_order,
        step_name: getReviewerStep(reviewer)?.step_name,
      }));
    }
  }

  return {
    data: {
      order,
      profile: order.profile || { name: "Нэр байхгүй" },
      items: items || [],
      instance: latestInstance || null,
      reviewers,
    },
    error: null,
  };
}

export interface AwaitingOrder {
  id: number;
  status: string;
  created_at: string;
  order_instances?: {
    id: number;
    current_step_order: number;
    status: string;
    orders?: {
      id: number;
      order_number: string;
      title: string;
      urgency_level: string;
      created_at: string;
      requested_delivery_date: string;
      profile?: {
        id: number;
        name: string;
        department_name: string;
      } | null;
    } | null;
  } | null;
  order_instance?: {
    id: number;
    current_step_order: number;
    status: string;
    order?: {
      id: number;
      order_number: string;
      title: string;
      urgency_level: string;
      created_at: string;
      created_profile?: {
        id: number;
        name: string;
        department_name: string;
      } | null;
    } | null;
  } | null;
}

export type Order = {
  id: number;
  order_number: string;
  title: string;
  description?: string;
  order_type:
    | "emergency"
    | "service"
    | "major repairs"
    | "safety reserves"
    | "other";
  urgency_level: "";
  requested_delivery_date?: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  order_process_id: string;
  notes?: string;
};

export type OrderItem = {
  id: number;
  order_id: number;
  part_number?: string;
  part_name: string;
  part_description?: string;
  manufacturer?: string;
  quantity: number;
  status: string;
  notes?: string;
  unit: string;
  image_url?: string;
  spare_type: string;
};

export type CreateOrderItemInput = Pick<
  OrderItem,
  | "part_number"
  | "part_name"
  | "part_description"
  | "manufacturer"
  | "quantity"
  | "unit"
  | "notes"
  | "image_url"
  | "spare_type"
>;

type ActionError = {
  message: string;
};

export interface OrderReviewers {
  id: number | string;
  order_id: number;
  reviewer_type: string;
  assigned_at: string;
  completed_at?: string;
  status: string;
  is_reviewed: boolean;
  comments?: string;
  profile?: {
    id: string;
    name?: string;
    department_name?: string;
    phone?: string;
    position_name?: string;
  };
  profile_id?: number;
  sender_id?: number;
  sub_order_item?: SubOrderItem[];
}

export interface SubOrderItem {
  id: number;
  status: string;
  order_id: number;
  quantity: number;
  created_at: string;
  created_by: number;
  description?: string;
  order_item_id: number;
}

export async function getOrdersByUser(): Promise<{
  data: Order[];
  error: PostgrestError | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Хэрэглэгчийн мэдээлэл авах үед алдаа гарлаа.");
  }
  const auth_user_id = user?.id;
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("auth_user_id", auth_user_id)
    .order("created_at", { ascending: false });

  return { data: data ?? [], error };
}

export async function addOrderItem(orderItem: Partial<OrderItem>): Promise<{
  data: OrderItem | null;
  error: PostgrestError | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_items")
    .insert(orderItem)
    .select()
    .single();

  return { data, error };
}

export const deleteImagesFromStorage = async (urls: string[]) => {
  try {
    const supabase = getSupabaseAdmin();

    for (const url of urls) {
      const fileName = url.split("/").pop();
      if (fileName) {
        const { error } = await supabase.storage
          .from("order-item-bucket")
          .remove([fileName]);

        if (error) {
          console.error(`Зураг устгахад алдаа: ${fileName}`, error);
        }
      }
    }
  } catch (error) {
    console.error("Зураг устгахад алдаа гарлаа:", error);
  }
};

export async function createOrderWithInstace(
  orderData: Partial<Order>,
): Promise<{
  data: Order | null;
  error: PostgrestError | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Хэрэглэгчийн мэдээлэл авах үед алдаа гарлаа.");
  }
  const auth_user_id = user?.id;
  const profile_id = await getProfileIdFromAuthUserId();
  const allowedProcesses = await getOrderProcessesForCurrentUser();
  const requestedProcessId = String(orderData.order_process_id);

  if (!allowedProcesses.some((process) => process.id === requestedProcessId)) {
    throw new Error("Энэ захиалгын төрлөөр захиалга үүсгэх эрхгүй байна.");
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({
      ...orderData,
      created_profile: profile_id,
      auth_user_id: auth_user_id,
    })
    .select()
    .single();

  if (data) {
    const { data: instance, error: instancesError } = await supabase
      .from("order_instances")
      .insert({
        order_id: data.id,
        order_process_id: orderData.order_process_id,
        current_step_order: 1,
        status: "in_progress",
      })
      .select()
      .single();

    if (!instance) {
      throw new Error("Process instance үүсгэхэд алдаа гарлаа");
    }

    if (instancesError)
      throw new Error(
        instancesError.message + "захиалгын төрлүүдийг татах үед алдаа гарлаа",
      );

    const { data: step, error: stepError } = await supabase
      .from("order_steps")
      .select("id")
      .eq("order_process_id", orderData.order_process_id)
      .eq("step_order", 1)
      .single();

    if (stepError || !step) {
      throw new Error(
        "Захиалга үүсгэн хянагчид холбох гэтэл эхний шат олдсонгүй",
      );
    }

    const { data: stepRoles, error: roleError } = await supabase
      .from("order_step_roles")
      .select("role_id")
      .eq("order_step_id", step.id);

    if (roleError || !stepRoles?.length) {
      throw new Error("Эхний шатанд role тохируулаагүй байна");
    }

    const roleIds = stepRoles.map((r) => r.role_id);

    const { data: profiles, error: profileError } = await supabase
      .from("roles_profiles")
      .select("profile_id, role_id")
      .in("role_id", roleIds);

    if (profileError || !profiles?.length) {
      throw new Error("Энэ шатанд хянах хүн олдсонгүй");
    }

    const reviewersPayload = profiles.map((p) => ({
      order_instance_id: instance.id,
      order_step_id: step.id,
      reviewer_profile_id: p.profile_id,
      role_id: p.role_id,
      status: "pending",
    }));

    const { error: reviewerError } = await supabase
      .from("order_step_reviewers")
      .insert(reviewersPayload);

    if (reviewerError) {
      throw new Error("Reviewer үүсгэхэд алдаа гарлаа");
    }
  }

  return { data, error };
}

export async function createOrderWithItems({
  orderData,
  items,
}: {
  orderData: Partial<Order>;
  items: CreateOrderItemInput[];
}): Promise<{
  data: Order | null;
  error: ActionError | null;
}> {
  const supabase = await createClient();

  let orderId: number | null = null;
  let instanceId: number | null = null;
  let reviewersCreated = false;

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Хэрэглэгчийн мэдээлэл авах үед алдаа гарлаа.");
    }

    if (items.length === 0) {
      throw new Error("Захиалгад дор хаяж нэг сэлбэг нэмнэ үү.");
    }

    const profile_id = await getProfileIdFromAuthUserId();
    const allowedProcesses = await getOrderProcessesForCurrentUser();
    const requestedProcessId = String(orderData.order_process_id);

    if (!allowedProcesses.some((process) => process.id === requestedProcessId)) {
      throw new Error("Энэ захиалгын төрлөөр захиалга үүсгэх эрхгүй байна.");
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        ...orderData,
        created_profile: profile_id,
        auth_user_id: user.id,
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message || "Захиалга үүсгэхэд алдаа гарлаа");
    }

    orderId = order.id;

    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item) => ({
        ...item,
        order_id: order.id,
        status: "pending",
      })),
    );

    if (itemsError) {
      throw new Error(`Сэлбэг нэмэхэд алдаа гарлаа: ${itemsError.message}`);
    }

    const { data: instance, error: instancesError } = await supabase
      .from("order_instances")
      .insert({
        order_id: order.id,
        order_process_id: orderData.order_process_id,
        current_step_order: 1,
        status: "in_progress",
      })
      .select()
      .single();

    if (instancesError || !instance) {
      throw new Error(
        instancesError?.message || "Process instance үүсгэхэд алдаа гарлаа",
      );
    }

    instanceId = instance.id;

    const { data: step, error: stepError } = await supabase
      .from("order_steps")
      .select("id")
      .eq("order_process_id", orderData.order_process_id)
      .eq("step_order", 1)
      .single();

    if (stepError || !step) {
      throw new Error(
        "Захиалга үүсгэн хянагчид холбох гэтэл эхний шат олдсонгүй",
      );
    }

    const { data: stepRoles, error: roleError } = await supabase
      .from("order_step_roles")
      .select("role_id")
      .eq("order_step_id", step.id);

    if (roleError || !stepRoles?.length) {
      throw new Error("Эхний шатанд role тохируулаагүй байна");
    }

    const roleIds = stepRoles.map((r) => r.role_id);

    const { data: profiles, error: profileError } = await supabase
      .from("roles_profiles")
      .select("profile_id, role_id")
      .in("role_id", roleIds);

    if (profileError || !profiles?.length) {
      throw new Error("Энэ шатанд хянах хүн олдсонгүй");
    }

    const { error: reviewerError } = await supabase
      .from("order_step_reviewers")
      .insert(
        profiles.map((profile) => ({
          order_instance_id: instance.id,
          order_step_id: step.id,
          reviewer_profile_id: profile.profile_id,
          role_id: profile.role_id,
          status: "pending",
        })),
      );

    if (reviewerError) {
      throw new Error(`Reviewer үүсгэхэд алдаа гарлаа: ${reviewerError.message}`);
    }

    reviewersCreated = true;

    return { data: order as Order, error: null };
  } catch (error) {
    if (instanceId) {
      if (reviewersCreated) {
        await supabase
          .from("order_step_reviewers")
          .delete()
          .eq("order_instance_id", instanceId);
      }

      await supabase.from("order_instances").delete().eq("id", instanceId);
    }

    if (orderId) {
      await supabase.from("orders").delete().eq("id", orderId);
    }

    console.error("Error creating order with items:", error);

    return {
      data: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : "Захиалга үүсгэхэд алдаа гарлаа",
      },
    };
  }
}

export async function getAwaitingOrders(profile_id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("order_step_reviewers")
    .select(
      `
      id,
      status,
      created_at,
      order_instances (
        id,
        current_step_order,
        status,
        orders (
          id,
          order_number,
          title,
          urgency_level,
          created_at,
          requested_delivery_date,
          profile(id, name, department_name)
        )
      )
    `,
    )
    .eq("reviewer_profile_id", profile_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching awaiting orders:", error);
    throw new Error(
      "Шалгагдахаар хүлээгдэж буй захиалгуудыг авахад алдаа гарлаа",
    );
  }

  return data as unknown as AwaitingOrder[] | null;
}
