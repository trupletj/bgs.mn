import type { SupplierSearchResult } from "@/actions/order-purchases";

export type FulfillmentRow = {
  id: string;
  quantity: number | string | null;
  status: string;
  notes?: string | null;
  created_at: string;
};

export type OrderProcessItem = {
  id: number;
  part_name: string;
  part_number?: string | null;
  part_description?: string | null;
  manufacturer?: string | null;
  quantity: number | string;
  unit: string;
  final_quantity: number | string | null;
  notes?: string | null;
  spare_type?: string | null;
  image_url?: string | null;
  order_title?: string | null;
  order_requested_delivery_date?: string | null;
  order_fulfillment: FulfillmentRow[];
};

export type PurchaseDocumentRow = {
  id: string;
  doc_type: "invoice" | "payment_receipt";
  file_name: string;
  mime_type?: string | null;
  file_size?: number | string | null;
  created_at: string;
};

export type FulfillmentStatusHistoryRow = {
  id: string;
  old_status?: string | null;
  new_status: string;
  reason?: string | null;
  created_at: string;
  profile?: { name?: string | null } | null;
};

export type PurchaseFulfillmentChunkRow = {
  id: number;
  purchase_line_id?: number | null;
  quantity: number | string;
  status: string;
  created_at: string;
  notes?: string | null;
  fulfillment_status_history: FulfillmentStatusHistoryRow[];
};

export type PurchaseLineRow = {
  id: number;
  order_item_id: number;
  quantity: number | string;
  unit_price: number | string;
  currency: string;
  vat_amount?: number | string | null;
  discount_amount?: number | string | null;
  notes?: string | null;
  created_at: string;
  order_items?: {
    id: number;
    part_name: string;
    part_number?: string | null;
    unit: string;
  } | null;
  order_fulfillment: PurchaseFulfillmentChunkRow[];
};

export type PurchaseBatchRow = {
  id: number;
  order_id: number;
  quote_id?: number | null;
  reference_number?: string | null;
  purchased_at?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  created_at: string;
  order_suppliers?: SupplierSearchResult | null;
  order_purchase_quotes?: {
    id: number;
    quote_number?: string | null;
    quote_date?: string | null;
    order_suppliers?: SupplierSearchResult | null;
  } | null;
  order_purchase_documents: PurchaseDocumentRow[];
  order_purchase_lines: PurchaseLineRow[];
};

export type PurchaseQuoteDocumentRow = {
  id: string;
  file_name: string;
  mime_type?: string | null;
  file_size?: number | string | null;
  created_at: string;
};

export type PurchaseQuoteLineRow = {
  id: number;
  order_item_id: number;
  quantity: number | string;
  unit_price: number | string;
  currency: string;
  notes?: string | null;
  order_items?: {
    id: number;
    part_name: string;
    part_number?: string | null;
    unit: string;
  } | null;
};

export type PurchaseQuoteRow = {
  id: number;
  order_id: number;
  supplier_id: number;
  quote_number?: string | null;
  quote_date?: string | null;
  valid_until?: string | null;
  notes?: string | null;
  created_at: string;
  order_suppliers?: SupplierSearchResult | null;
  order_purchase_quote_documents: PurchaseQuoteDocumentRow[];
  order_purchase_quote_lines: PurchaseQuoteLineRow[];
};
