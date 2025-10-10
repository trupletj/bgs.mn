// utils/workflow.ts
export const STEP_SEQUENCE = [
  "created_step",
  "first_step",
  "second_step",
  "third_step",
  "fourth_step",
] as const;

export type StepType = (typeof STEP_SEQUENCE)[number];

export type OrderStatus = StepType | "completed" | "rejected";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  created_step: "Үүсгэгдсэн",
  first_step: "1-р шат",
  second_step: "2-р шат",
  third_step: "3-р шат",
  fourth_step: "4-р шат",
  completed: "Дууссан",
  rejected: "Татгалзсан",
};

export function getNextStep(currentStep: StepType): StepType | null {
  const currentIndex = STEP_SEQUENCE.indexOf(currentStep);
  return currentIndex >= 0 && currentIndex < STEP_SEQUENCE.length - 1
    ? STEP_SEQUENCE[currentIndex + 1]
    : null;
}

export function getStepRoleId(step: StepType): string {
  const roleMapping: Record<StepType, string> = {
    created_step: "9", // technical_reviewer
    first_step: "10", // technical_reviewer
    second_step: "11", // department_approver
    third_step: "12", // finance_approver
    fourth_step: "13", // final_approver
  };
  return roleMapping[step];
}

export function isValidStep(step: string): step is StepType {
  return STEP_SEQUENCE.includes(step as StepType);
}

export function getStepStatus(step: StepType): string {
  return `passed_${step.split("_")[0]}`;
}

// Шинэ helper function
export function canReviewerAccess(
  orderStatus: OrderStatus,
  reviewerStep: StepType
): boolean {
  const orderStepIndex = STEP_SEQUENCE.indexOf(orderStatus as StepType);
  const reviewerStepIndex = STEP_SEQUENCE.indexOf(reviewerStep);

  // Хэрэглэгч өөрийн шат болон өмнөх шатуудыг харж болно
  return reviewerStepIndex <= orderStepIndex;
}

export function isCurrentStep(
  orderStatus: OrderStatus,
  reviewerStep: StepType
): boolean {
  return orderStatus === reviewerStep;
}
