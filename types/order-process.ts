export interface OrderStepRole {
  role_id: number;
  role_name?: string;
}

export interface OrderStepInput {
  step_order: number;
  step_name: string;
  roles: OrderStepRole[];
}

export interface OrderProcessInput {
  name: string;
  steps: OrderStepInput[];
}

export interface OrderStep extends OrderStepInput {
  id: number;
  created_at: string;
  order_process_id: number;
}

export interface OrderProcess {
  id: number;
  name: string;
  created_at: string;
  id_deleted: boolean;
  steps: OrderStep[];
}

export interface CreateOrderProcessResult {
  success: boolean;
  processId?: number;
  error?: string;
}

export interface GetOrderProcessResult {
  success: boolean;
  data?: OrderProcess;
  error?: string;
}

export interface OrderInstance {
  id: number;
  created_at: string;
  order_id: number;
  order_process_id: number;
  current_step_order: number;
  status: string;
  completed_at?: string;
}
