export interface OrderItemForm {
  // part_id?: number;
  part_number?: string;
  part_name: string;
  part_description?: string;
  manufacturer?: string;
  quantity: number;
  notes?: string;
  image_url?: string;
  unit?: string;
}