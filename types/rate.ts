import { SparePartType } from "./types";

// types/rate.ts
export interface OrderItem {
  id: number;
  order_id: number;
  part_name: string;
  part_number?: string;
  part_description?: string;
  quantity: number;
  unit: string;
  spare_type: SparePartType;
  image_url?: string;
  status: string;
  notes?: string;
}

export interface SubOrderItem {
  id: number;
  order_item_id: number;
  quantity: number;
  status: string;
  description: string;
  created_at: string;
  created_by: number;
  reviewer_profile?: {
    name: string;
  };
}

export interface OrderDetails {
  id: number;
  order_number: string;
  title: string;
  description?: string;
  status: string;
  urgency_level: string;
  requested_delivery_date?: string;
  created_at: string;
  order_type: string;
  created_profile: number;
  profile?: {
    name: string;
    department_name: string;
  };
}

export interface OrderInstance {
  id: number;
  order_id: number;
  order_process_id: number;
  current_step_order: number;
  status: string;
  completed_at?: string;
}

export interface OrderStepReviewer {
  id: number;
  order_instance_id: number;
  order_step_id: number;
  reviewer_profile_id: number;
  status: "pending" | "approved" | "rejected" | "changes_requested" | "skipped";
  reviewed_at?: string;
  role_id: number;
}

export interface OrderStep {
  id: number;
  step_order: number;
  step_name: string;
  required_approval_count: number;
}

export interface ReviewActionData {
  order_instance_id: number;
  order_step_id: number;
  status: "approved" | "rejected" | "changes_requested";
  comments: string;
  newQuantities?: Record<string, number>;
  reviewer_profile_id: number;
}
