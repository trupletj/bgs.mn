export interface Order {
  id: string;
  title: string;
  status: string;
  management_status?: string;
  created_at: string;
  profile?: {
    name?: string;
    department_name?: string;
  };
}

export interface StatusHistory {
  id: string;
  order_id: string;
  status_type: "main" | "management";
  old_status?: string;
  new_status: string;
  changed_by?: string;
  reason?: string;
  created_at: string;
  profile?: {
    name?: string;
  };
}
