// actions/rate.ts
"use server";

import { createClient } from "@/utils/supabase/client";
import { revalidatePath } from "next/cache";

type ReviewStatus = "approved" | "rejected" | "changes_requested";

interface SubmitReviewParams {
  order_instance_id: number;
  order_step_id: number;
  status: ReviewStatus;
  comments: string;
  newQuantities?: Record<number, number>;
  reviewer_profile_id: number;
}

export async function submitReview(params: SubmitReviewParams) {
  const supabase = createClient();

  try {
    const checks = await performChecks(params);
    if (!checks.success) {
      return { success: false, error: checks.error };
    }

    const {
      order_id,
      current_step_order,
      required_approval_count,
      reviewer_role_id,
    } = checks;

    const { error: updateError } = await supabase
      .from("order_step_reviewers")
      .update({
        status: params.status,
        reviewed_at: new Date().toISOString(),
      })
      .eq("order_instance_id", params.order_instance_id)
      .eq("order_step_id", params.order_step_id)
      .eq("reviewer_profile_id", params.reviewer_profile_id);

    if (updateError) throw updateError;

    // 3. Ижил role-той бусад pending-г skipped болгох (approved эсвэл changes_requested үед)
    if (
      (params.status === "approved" || params.status === "changes_requested") &&
      reviewer_role_id
    ) {
      const { error: skipError } = await supabase
        .from("order_step_reviewers")
        .update({ status: "skipped" })
        .eq("order_instance_id", params.order_instance_id)
        .eq("order_step_id", params.order_step_id)
        .eq("role_id", reviewer_role_id)
        .eq("status", "pending")
        .neq("reviewer_profile_id", params.reviewer_profile_id);

      if (skipError) throw skipError;
    }

    // 4. Changes requested бол sub_order_item үүсгэх
    if (
      params.status === "changes_requested" &&
      params.newQuantities &&
      Object.keys(params.newQuantities).length > 0
    ) {
      const subItems = Object.entries(params.newQuantities).map(
        ([itemId, qty]) => ({
          order_item_id: Number(itemId),
          quantity: qty,
          status: "changes_requested",
          description:
            params.comments.trim() || "Тоо хэмжээний өөрчлөлт шаардлагатай",
          created_by: params.reviewer_profile_id,
          order_id,
          order_instance_id: params.order_instance_id,
          order_step_id: params.order_step_id,
          reviewer_profile_id: params.reviewer_profile_id,
        })
      );

      const { error: insertError } = await supabase
        .from("sub_order_item")
        .insert(subItems);
      if (insertError) throw insertError;
    }

    // 5. Татгалзсан бол instance-г rejected болгох
    if (params.status === "rejected") {
      const { error } = await supabase
        .from("order_instances")
        .update({
          status: "rejected",
          completed_at: new Date().toISOString(),
        })
        .eq("id", params.order_instance_id);

      if (error) throw error;
    }

    // 6. Approved эсвэл changes_requested бол дараагийн алхам руу шилжих эсэхийг шалгах
    if (params.status === "approved" || params.status === "changes_requested") {
      await checkAndMoveToNextStep({
        order_instance_id: params.order_instance_id,
        order_step_id: params.order_step_id,
        current_step_order,
        required_approval_count,
      });
    }

    // Revalidate
    revalidatePath(`/orders/list`);

    return { success: true };
  } catch (error) {
    console.error("Review submission error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Серверт алдаа гарлаа",
    };
  }
}

async function performChecks(params: SubmitReviewParams) {
  const supabase = createClient();

  // 1. Одоогийн reviewer-ийн мэдээлэл + алхам + instance
  const { data, error } = await supabase
    .from("order_step_reviewers")
    .select(
      `
      status,
      role_id,
      order_steps!inner(
        step_order,
        required_approval_count,
        order_process_id
      ),
      order_instances!inner(
        id,
        order_id,
        current_step_order,
        status
      )
    `
    )
    .eq("order_instance_id", params.order_instance_id)
    .eq("order_step_id", params.order_step_id)
    .eq("reviewer_profile_id", params.reviewer_profile_id)
    .single();

  if (error || !data) {
    return { success: false, error: "Шалгах эрхгүй эсвэл захиалга олдсонгүй" };
  }

  const order_steps = Array.isArray(data.order_steps)
    ? data.order_steps[0]
    : data.order_steps;
  const order_instances = Array.isArray(data.order_instances)
    ? data.order_instances[0]
    : data.order_instances;

  // Одоогийн алхмын шалгалтууд
  if (data.status !== "pending") {
    return { success: false, error: "Та аль хэдийн шалгасан байна" };
  }

  if (
    order_instances.status === "completed" ||
    order_instances.status === "rejected"
  ) {
    return { success: false, error: "Захиалга аль хэдийн дууссан байна" };
  }

  if (order_steps.step_order !== order_instances.current_step_order) {
    return { success: false, error: "Буруу алхам байна." };
  }

  if (params.status === "rejected" && !params.comments.trim()) {
    return { success: false, error: "Татгалзах шалтгаанаа оруулна уу" };
  }

  if (params.status === "changes_requested") {
    const hasQuantityChange =
      params.newQuantities && Object.keys(params.newQuantities).length > 0;
    const hasComment = params.comments.trim().length > 0;
    if (!hasQuantityChange && !hasComment) {
      return {
        success: false,
        error: "Ядаж нэг тоо хэмжээ өөрчлөх эсвэл тайлбар оруулна уу",
      };
    }
  }

  // 2. Хэрэв rejected биш бол (approved эсвэл changes_requested) → дараагийн алхмуудыг шалгах
  if (params.status !== "rejected") {
    const process_id = order_steps.order_process_id;
    const current_step_order = order_steps.step_order;

    // Бүх үлдэгдэл алхмуудыг авах
    const { data: remainingSteps, error: stepsError } = await supabase
      .from("order_steps")
      .select("id, step_order")
      .eq("order_process_id", process_id)
      .gt("step_order", current_step_order)
      .order("step_order", { ascending: true });

    if (stepsError) {
      return {
        success: false,
        error: "Процессын мэдээлэл авахад алдаа гарлаа",
      };
    }

    // Хэрэв дараагийн алхам байхгүй бол → сүүлийн алхам → зөвшөөрнө
    if (!remainingSteps || remainingSteps.length === 0) {
      // Зөвшөөрнө – completed болно
    } else {
      // Дараагийн алхам бүрт reviewer байгаа эсэхийг шалгах
      for (const step of remainingSteps) {
        const canProceed = await canCreateReviewersForStep(step.id);
        if (!canProceed) {
          return {
            success: false,
            error: `Дараагийн алхам (${step.step_order}-р алхам)-д шалгагч (role эсвэл хэрэглэгч) байхгүй байна. Зөвшөөрөх боломжгүй.`,
          };
        }
      }
    }
  }

  // Бүх шалгалт давсан → зөвшөөрнө
  return {
    success: true,
    order_id: order_instances.order_id,
    current_step_order: order_instances.current_step_order,
    required_approval_count: order_steps.required_approval_count || 1,
    reviewer_role_id: data.role_id,
  };
}

// Туслах функц: Алхамд reviewer үүсгэх боломжтой эсэх
async function canCreateReviewersForStep(step_id: number): Promise<boolean> {
  const supabase = createClient();

  const { data: roles, error: rolesError } = await supabase
    .from("order_step_roles")
    .select("role_id")
    .eq("order_step_id", step_id);

  if (rolesError || !roles || roles.length === 0) {
    return false; // Role байхгүй
  }

  for (const { role_id } of roles) {
    const { count, error: countError } = await supabase
      .from("roles_profiles")
      .select("profile_id", { count: "exact", head: true })
      .eq("role_id", role_id);

    if (countError || (count ?? 0) === 0) {
      return false; // Тухайн role-д хэрэглэгч байхгүй
    }
  }

  return true;
}

async function checkAndMoveToNextStep({
  order_instance_id,
  order_step_id,
  current_step_order,
  required_approval_count,
}: {
  order_instance_id: number;
  order_step_id: number;
  current_step_order: number;
  required_approval_count: number;
}) {
  const supabase = createClient();

  const { data: reviewers, error } = await supabase
    .from("order_step_reviewers")
    .select("status, role_id")
    .eq("order_instance_id", order_instance_id)
    .eq("order_step_id", order_step_id);

  if (error || !reviewers) return;

  if (reviewers.some((r) => r.status === "rejected")) return;

  const approvedRoles = new Set<number>();
  for (const r of reviewers) {
    if (r.status === "approved" || r.status === "changes_requested") {
      approvedRoles.add(r.role_id);
    }
  }

  if (approvedRoles.size < required_approval_count) return;

  await moveToNextStep(
    order_instance_id,
    order_step_id,
    current_step_order,
    required_approval_count
  );
}

async function moveToNextStep(
  order_instance_id: number,
  current_step_id: number,
  current_step_order: number,
  required_approval_count: number
) {
  const supabase = createClient();

  const { data: currentStep } = await supabase
    .from("order_steps")
    .select("order_process_id")
    .eq("id", current_step_id)
    .single();

  if (!currentStep) return;

  const { data: nextStep } = await supabase
    .from("order_steps")
    .select("id")
    .eq("order_process_id", currentStep.order_process_id)
    .eq("step_order", current_step_order + 1)
    .maybeSingle();

  if (!nextStep) {
    // Сүүлийн алхам үед энд ирнэ
    await supabase
      .from("order_instances")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", order_instance_id);
    finalizeOrder(order_instance_id);
    return;
  }

  // Дараагийн алхам руу шилжих
  await supabase
    .from("order_instances")
    .update({ current_step_order: current_step_order + 1 })
    .eq("id", order_instance_id);

  await createNextStepReviewers(
    order_instance_id,
    nextStep.id,
    required_approval_count
  );
}

async function createNextStepReviewers(
  order_instance_id: number,
  next_step_id: number,
  required_approval_count: number
) {
  const supabase = createClient();

  //дараагийн шатны бүх role-уудаа авна
  const { data: roles } = await supabase
    .from("order_step_roles")
    .select("role_id")
    .eq("order_step_id", next_step_id);

  if (!roles || roles.length === 0) {
    throw new Error("Дараагийн алхамд role тодорхойлогдоогүй байна");
  }

  // profile_id -> Set<role_id>
  const reviewerMap = new Map<number, Set<number>>();

  for (const { role_id } of roles) {
    //role бүрт хамаарах хэрэглэгчдийг авна
    const { data: profiles } = await supabase
      .from("roles_profiles")
      .select("profile_id")
      .eq("role_id", role_id);

    if (!profiles || profiles.length === 0) {
      throw new Error(`Role ID ${role_id}-д хэрэглэгч олдсонгүй`);
    }

    for (const { profile_id } of profiles) {
      if (!profile_id) continue;
      if (!reviewerMap.has(profile_id)) {
        reviewerMap.set(profile_id, new Set());
      }
      reviewerMap.get(profile_id)!.add(role_id);
    }
  }

  const reviewers = Array.from(reviewerMap.entries())
    .filter(([profile_id]) => profile_id !== null)
    .map(([profile_id, roleIds]) => ({
      order_instance_id,
      order_step_id: next_step_id,
      reviewer_profile_id: profile_id,
      role_id: Math.min(...Array.from(roleIds)),
      status: "pending",
    }));

  if (reviewers.length < required_approval_count) {
    throw new Error(
      "Дараагийн алхамд шаардлагатай шалгагчдын тоо хүрэлцэхгүй байна"
    );
  }

  const { error } = await supabase
    .from("order_step_reviewers")
    .insert(reviewers);

  if (error) throw error;
}

async function finalizeOrder(order_instance_id: number) {
  const supabase = createClient();

  const { data: instance, error: instanceError } = await supabase
    .from("order_instances")
    .select("order_id, order_process_id")
    .eq("id", order_instance_id)
    .single();

  if (instanceError || !instance) {
    throw new Error("Instance олдсонгүй");
  }

  const { order_id, order_process_id } = instance;

  /* FINAL STEP (хамгийн сүүлийн STEP) */
  const { data: finalStep, error: stepError } = await supabase
    .from("order_steps")
    .select("id")
    .eq("order_process_id", order_process_id)
    .order("step_order", { ascending: false })
    .limit(1)
    .single();

  if (stepError || !finalStep) {
    throw new Error("Final step олдсонгүй");
  }

  const final_step_id = finalStep.id;

  /* Order items (анхны + өмнөх final_quantity)      */
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, quantity, final_quantity")
    .eq("order_id", order_id);

  if (itemsError || !items) return;

  /* FINAL STEP дээрх sub_order_item-үүд              */
  const { data: subs, error: subsError } = await supabase
    .from("sub_order_item")
    .select("order_item_id, quantity")
    .eq("order_instance_id", order_instance_id)
    .eq("order_step_id", final_step_id);

  if (subsError) {
    throw new Error("Final sub_order_item уншиж чадсангүй");
  }
  const finalMap = new Map<number, number>();

  for (const sub of subs || []) {
    finalMap.set(sub.order_item_id, sub.quantity);
  }

  for (const item of items) {
    const finalQty =
      finalMap.get(item.id) ?? // final step дээр өөрчилсөн
      item.final_quantity ?? // өмнө батлагдсан
      item.quantity; // анхны

    await supabase
      .from("order_items")
      .update({ final_quantity: finalQty })
      .eq("id", item.id);
  }

  const hasChanges = subs && subs.length > 0;

  const finalOrderStatus = hasChanges ? "changes_requested" : "approved";

  await supabase
    .from("orders")
    .update({ status: finalOrderStatus })
    .eq("id", order_id);

  //Ижилхэн finalOrderStatus-тай болгох хэрэгтэй байх гэхдээ ялгаатай байлгая
  await supabase
    .from("order_instances")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", order_instance_id);
}
