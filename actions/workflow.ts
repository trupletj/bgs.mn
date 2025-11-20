// actions/workflow.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { STEP_SEQUENCE, getNextStep, isValidStep } from "@/utils/workflow";

export async function updateOrderStepStatus(
  orderId: string,
  currentStep: string,
  profile_id: string
) {
  const supabase = await createClient();

  if (!isValidStep(currentStep)) {
    throw new Error(`Invalid step: ${currentStep}`);
  }

  try {
    console.log("current step", currentStep);
    //Тухайн шатны бүх шалгуулагчдын мэдээллийг авч байна
    const { data: reviewers, error: reviewersError } = await supabase
      .from("order_reviewers")
      .select("*")
      .eq("order_id", orderId)
      .eq("reviewer_type", currentStep);

    if (reviewersError) throw new Error(reviewersError.message);

    console.log("reviewers", reviewers);
    if (!reviewers || reviewers.length === 0) {
      return { status: "pending" };
    }

    // Давхардсан profile_id-уудыг бүлэглэх
    const profileGroups: Record<string, any[]> = reviewers.reduce(
      (acc: Record<string, any[]>, reviewer: any) => {
        if (!acc[reviewer.profile_id]) acc[reviewer.profile_id] = [];
        acc[reviewer.profile_id].push(reviewer);
        return acc;
      },
      {}
    );

    console.log("Profile", profileGroups);

    // Нийт ялгаатай profile_id-ийн тоо
    const totalProfiles = Object.keys(profileGroups).length;

    console.log("totalProfiles", totalProfiles);

    // Шалгасан profile_id-уудын тоо (дор хаяж нэг is_reviewed=true мөртэй)
    const reviewedProfiles = Object.values(profileGroups).filter(
      (group: any[]) => group.some((r: { is_reviewed: any }) => r.is_reviewed)
    ).length;

    console.log("reviewedProfiles", reviewedProfiles);

    // --------------------------
    // Бүх profile_id дор хаяж нэг шалгасан бол үргэлжлүүлнэ
    if (totalProfiles > 0 && reviewedProfiles === totalProfiles) {
      // Ядаж нэг татгалзсан байгаа эсэхийг шалгах
      const hasRejection = reviewers.some((r) => r.status === "rejected");

      if (hasRejection) {
        // Нэг ч татгалзсан байвал бүх шатыг татгалзсан болгох
        const { error } = await supabase
          .from("orders")
          .update({
            status: "rejected",
            rejected_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        if (error) throw new Error(error.message);
        return { status: "rejected" };
      }

      const nextStep = getNextStep(currentStep as any);
      let newStatus = nextStep ? nextStep : "completed";

      let updateData: any = { status: currentStep };

      switch (currentStep) {
        case "first_step":
          updateData.is_passed_first = true;
          break;
        case "second_step":
          updateData.is_passed_second = true;
          break;
        case "third_step":
          updateData.is_passed_third = true;
          break;
        case "fourth_step":
          updateData.is_passed_fourth = true;
          break;
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId);

      if (error) throw new Error(error.message);

      // Бүх хүн шалгаж, эерэг үзүүлэлттэй бол approved буцаана
      return { status: "approved", nextStep: newStatus };
    }

    //Тухайн шатны 1 хүнийг 2 удаа дуудсан гэхдээ DB-д нэг мөрийг шинэчилж байгаа тул бүх хүн шалгасан гэж үзэхгүй байна.

    // Нийт шалгуулагчдын тоо
    // const totalReviewers = reviewers.length;

    // // Шалгасан хүмүүсийн тоо
    // const reviewedReviewers = reviewers.filter((r) => r.is_reviewed).length;

    // // Бүх хүн шалгаж дууссан эсэхийг шалгах
    // if (totalReviewers > 0 && reviewedReviewers === totalReviewers) {
    //   // Ядаж нэг татгалзсан байгаа эсэхийг шалгах
    //   const hasRejection = reviewers.some((r) => r.status === "rejected");

    //   if (hasRejection) {
    //     // Нэг ч татгалзсан байвал бүх шатыг татгалзсан болгох
    //     const { error } = await supabase
    //       .from("orders")
    //       .update({
    //         status: "rejected",
    //         rejected_at: new Date().toISOString(),
    //       })
    //       .eq("id", orderId);

    //     if (error) throw new Error(error.message);
    //     return { status: "rejected" };
    //   }

    //   // Бүгд зөвшөөрсөн эсвэл өөрчлөлттэй зөвшөөрсөн байгаа эсэхийг шалгах
    //   const allApprovedOrChangesRequested = reviewers.every(
    //     (r) => r.status === "approved" || r.status === "changes_requested"
    //   );

    //   if (allApprovedOrChangesRequested) {
    //     const nextStep = getNextStep(currentStep as any);
    //     let newStatus = nextStep ? nextStep : "completed";

    //     let updateData: any = { status: currentStep };

    //     switch (currentStep) {
    //       case "first_step":
    //         updateData.is_passed_first = true;
    //         break;
    //       case "second_step":
    //         updateData.is_passed_second = true;
    //         break;
    //       case "third_step":
    //         updateData.is_passed_third = true;
    //         break;
    //       case "fourth_step":
    //         updateData.is_passed_fourth = true;
    //         break;
    //     }

    //     const { error } = await supabase
    //       .from("orders")
    //       .update(updateData)
    //       .eq("id", orderId);

    //     if (error) throw new Error(error.message);
    //     // бүх хүн шалгаж эерэг үзүүлэлттэй зөшөөрсөн үед approved буцаана.
    //     return { status: "approved", nextStep: newStatus };
    //   }
    // }
    //бүгд шалгаагүй үед pending-status буцаана.
    return { status: "pending" };
  } catch (error) {
    console.error("Update order step status error:", error);
    throw error;
  }
}

export async function checkStepCompletion(orderId: string, step: string) {
  const supabase = await createClient();

  try {
    console.log(
      `Checking step completion for order: ${orderId}, step: ${step}`
    );

    // Эхлээд orders хүснэгтээс is_passed статусыг шалгах
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "is_passed_first, is_passed_second, is_passed_third, is_passed_fourth"
      )
      .eq("id", orderId)
      .single();

    if (orderError) throw new Error(orderError.message);

    console.log("Order passed status:", order);

    // Өмнөх шатууд дууссан эсэхийг шалгах
    let previousStepsCompleted = true;

    switch (step) {
      case "second_step":
        previousStepsCompleted = order.is_passed_first === true;
        console.log(
          `First step passed: ${order.is_passed_first}, Previous steps completed: ${previousStepsCompleted}`
        );
        break;
      case "third_step":
        previousStepsCompleted =
          order.is_passed_first === true && order.is_passed_second === true;
        break;
      case "fourth_step":
        previousStepsCompleted =
          order.is_passed_first === true &&
          order.is_passed_second === true &&
          order.is_passed_third === true;
        break;
    }

    if (!previousStepsCompleted) {
      console.log("Previous steps not completed");
      return { canAccess: false, reason: "Өмнөх шатууд дуусаагүй байна" };
    }

    // Тухайн шатны бүх шалгуулагчдын статусыг шалгах
    const { data: stepReviewers, error } = await supabase
      .from("order_reviewers")
      .select("status, is_reviewed, profile_id")
      .eq("order_id", orderId)
      .eq("reviewer_type", step);

    if (error) throw error;

    console.log(`Step reviewers for ${step}:`, stepReviewers);

    if (!stepReviewers || stepReviewers.length === 0) {
      console.log("No reviewers found");
      return { canAccess: false, reason: "Шалгуулагч олдсонгүй" };
    }

    // Бүх шалгуулагч үнэлгээ өгсөн эсэх
    const allReviewed = stepReviewers.every((reviewer) => reviewer.is_reviewed);
    console.log(`All reviewers reviewed: ${allReviewed}`);

    if (!allReviewed) {
      const pendingReviewers = stepReviewers.filter(
        (reviewer) => !reviewer.is_reviewed
      );
      console.log(`Pending reviewers: ${pendingReviewers.length}`);
      return {
        canAccess: false,
        reason: "Бүх шалгуулагч үнэлгээ өгөөгүй байна",
      };
    }

    // Ядаж нэг татгалзсан байгаа эсэх
    const hasRejection = stepReviewers.some(
      (reviewer) => reviewer.status === "rejected"
    );
    console.log(`Has rejection: ${hasRejection}`);

    if (hasRejection) {
      return { canAccess: false, reason: "Шат татгалзсан байна" };
    }

    // Бүгд зөвшөөрсөн эсвэл өөрчлөлттэй зөвшөөрсөн байх
    const allApprovedOrChanges = stepReviewers.every(
      (reviewer) =>
        reviewer.status === "approved" ||
        reviewer.status === "changes_requested"
    );

    console.log(`All approved or changes: ${allApprovedOrChanges}`);

    return {
      canAccess: allApprovedOrChanges,
      reason: allApprovedOrChanges
        ? "Хандах боломжтой"
        : "Бүх шалгуулагч зөвшөөрөөгүй байна",
    };
  } catch (error) {
    console.error("Error checking step completion:", error);
    return { canAccess: false, reason: "Алдаа гарлаа" };
  }
}

// Шинэ функц: Тухайн захиалгын бүх шатны шалгуулагчдын мэдээлэл авах
export async function getOrderReviewHistory(orderId: string) {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("order_reviewers")
      .select(
        `
        *,
        profile:profile_id (
          id,
          name,
          position_name,
          department_name
        )
      `
      )
      .eq("order_id", orderId)
      .order("reviewer_type", { ascending: true })
      .order("assigned_at", { ascending: true });

    if (error) throw new Error(error.message);

    return data || [];
  } catch (error) {
    console.error("Get order review history error:", error);
    throw error;
  }
}
