"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { updateOrderStepStatus } from "./workflow";
import { getNextStep } from "@/utils/workflow";

interface SubmitReviewParams {
  status: "approved" | "rejected" | "changes_requested";
  order_id: string;
  comments: string;
  newQuantities: Record<number, number>;
  currentStep: string;
}

export async function getProfileIdFromAuthUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Хэрэглэгч олдсонгүй");
  }
  return supabase
    .from("profile")
    .select("id")
    .eq("auth_user_id", user.id)
    .single()
    .then(({ data, error }) => {
      if (error) {
        throw new Error("Профайл олдсонгүй");
      }
      return data?.id;
    });
}

export async function submitReview(params: SubmitReviewParams) {
  const supabase = await createClient();

  try {
    const profile_id = await getProfileIdFromAuthUserId();

    // ЗӨВШӨӨРӨЛТ: Зөвхөн өөрийн үнэлгээг шинэчлэх
    const { error: reviewerError } = await supabase
      .from("order_reviewers")
      .update({
        status: params.status,
        comments: params.comments,
        completed_at: new Date().toISOString(),
        is_reviewed: true,
      })
      .eq("order_id", params.order_id)
      .eq("profile_id", profile_id) // ЗӨВХӨН ӨӨРИЙН PROFILE_ID
      .eq("reviewer_type", params.currentStep);

    if (reviewerError) {
      throw new Error(reviewerError.message);
    }

    if (Object.keys(params.newQuantities).length > 0) {
      for (const [itemId, quantity] of Object.entries(params.newQuantities)) {
        const { error: subItemError } = await supabase
          .from("sub_order_item")
          .insert({
            order_item_id: parseInt(itemId),
            quantity: quantity,
            status: "changed_approved",
            created_by: profile_id,
          });

        if (subItemError) {
          console.error(
            `Sub order item хадгалахад алдаа: ${subItemError.message}`
          );
        }
      }
    }

    // Шинэчлэгдсэн: Бүх шалгуулагчдын статусыг шалгах
    const stepResult = await updateOrderStepStatus(
      params.order_id,
      params.currentStep
    );

    if (params.status === "rejected") {
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          status: "rejected",
          is_reviewed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.order_id);

      if (orderError) {
        console.error("Захиалгын статус шинэчлэхэд алдаа:", orderError);
      }
    }

    revalidatePath("/review-request");
    return {
      success: true,
      stepStatus: stepResult.status,
      nextStep: (stepResult as any).nextStep,
    };
  } catch (error) {
    console.error("Submit review error:", error);
    throw error;
  }
}

// export async function submitReview(params: SubmitReviewParams) {
//   const supabase = await createClient();

//   try {
//     const profile_id = await getProfileIdFromAuthUserId();
//     const { error: reviewerError } = await supabase
//       .from("order_reviewers")
//       .update({
//         status: params.status,
//         comments: params.comments,
//         completed_at: new Date().toISOString(),
//         is_reviewed: true,
//       })
//       .eq("order_id", params.order_id)
//       .eq("profile_id", profile_id)
//       .eq("reviewer_type", params.currentStep);

//     if (reviewerError) {
//       throw new Error(reviewerError.message);
//     }

//     if (Object.keys(params.newQuantities).length > 0) {
//       for (const [itemId, quantity] of Object.entries(params.newQuantities)) {
//         const { error: subItemError } = await supabase
//           .from("sub_order_item")
//           .insert({
//             order_item_id: parseInt(itemId),
//             quantity: quantity,
//             status: "changed_approved",
//             created_by: profile_id,
//           });

//         if (subItemError) {
//           console.error(
//             `Sub order item хадгалахад алдаа: ${subItemError.message}`
//           );
//         }
//       }
//     }

//     const stepResult = await updateOrderStepStatus(
//       params.order_id,
//       params.currentStep
//     );

//     if (params.status === "rejected") {
//       const { error: orderError } = await supabase
//         .from("orders")
//         .update({
//           status: "rejected",
//           is_reviewed: true,
//           updated_at: new Date().toISOString,
//         })
//         .eq("id", params.order_id);

//       if (orderError) {
//         console.error("Захиалгын статус шинэчлэхэд алдаа:", orderError);
//       }
//     }

//     revalidatePath("/review-request");
//     return {
//       success: true,
//       stepStatus: stepResult.status,
//       nextStep: (stepResult as any).nextStep,
//     };
//   } catch (error) {
//     console.error("Submit review error:", error);
//     throw error;
//   }
// }

interface AssignNextReviewersParams {
  order_id: string;
  reviewerIds: string[];
  currentStep: string;
}

export async function assignNextReviewers({
  order_id,
  reviewerIds,
  currentStep,
}: AssignNextReviewersParams) {
  const supabase = await createClient();

  try {
    const profile_id = await getProfileIdFromAuthUserId();
    const nextStep = getNextStep(currentStep as any);

    if (!nextStep) throw new Error("Дараагийн шат байхгүй байна");

    const reviewersToAdd = reviewerIds.map((userId) => ({
      order_id: order_id,
      profile_id: userId,
      reviewer_type: nextStep,
      status: "pending",
      sender_id: profile_id,
      is_reviewed: false,
      assigned_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("order_reviewers")
      .insert(reviewersToAdd);

    if (error) {
      throw new Error(error.message);
    }

    const nextStepStatus = `pending_${nextStep.replace("_step", "")}`;

    // const { error: orderError } = await supabase
    //   .from("orders")
    //   .update({ status: nextStepStatus })
    //   .eq("id", order_id);

    // if (orderError) {
    //   console.error("Захиалгын статус шинэчлэхэд алдаа:", orderError);
    // }

    revalidatePath("/review-request");
    return { success: true };
  } catch (error) {
    console.error("Assign next reviewers error:", error);
    throw error;
  }
}

export async function updateOrderItemQuantity(
  itemId: number,
  quantity: number
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("order_items")
    .update({ quantity: quantity })
    .eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/orders/[id]");
  return { success: true };
}

export async function checkAllReviewersApproved(order_id: number) {
  const supabase = await createClient();

  const { data: reviewers, error } = await supabase
    .from("order_reviewers")
    .select("status")
    .eq("order_id", order_id)
    .eq("reviewer_type", "first_step");

  if (error) {
    console.error("Шалгуулагчдын мэдээлэл авахад алдаа:", error);
    return false;
  }

  // Бүх шалгуулагчид баталгажуулсан эсэхийг шалгах
  const allApproved = reviewers.every(
    (reviewer) => reviewer.status === "approved"
  );

  if (allApproved) {
    // Дараагийн шатны хүнд шилжих
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "pending_department_approval" })
      .eq("id", order_id);

    if (updateError) {
      console.error("Статус шинэчлэхэд алдаа:", updateError);
    }
  }

  return allApproved;
}
