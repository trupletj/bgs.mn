"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getProfileIdFromAuthUserId } from "./profile";
import {
  assertCanAccessOrderItemPurchase,
  assertCanAccessOrderPurchase,
} from "./order-process";
import { hasPermission } from "./rbac";
import {
  DOCUMENT_UPLOAD_MAX_BYTES,
  getFileTooLargeMessage,
  PURCHASE_DOCUMENT_ALLOWED_MIME_TYPES,
} from "@/lib/file-upload-limits";

const PURCHASE_DOCUMENT_BUCKET = "order-purchase-documents";
const PURCHASE_QUOTE_BUCKET = "order-purchase-quotes";
const ALLOWED_DOCUMENT_TYPES = new Set<string>(
  PURCHASE_DOCUMENT_ALLOWED_MIME_TYPES,
);

const MOVEMENT_STATUSES = new Set([
  "purchased",
  "at_warehouse",
  "in_delivery",
  "at_mine",
  "completed",
  "cancelled",
]);

const NEXT_FULFILLMENT_STATUS: Record<string, string[]> = {
  purchased: [
    "at_warehouse",
    "in_delivery",
    "at_mine",
    "completed",
    "cancelled",
  ],
  at_warehouse: [
    "purchased",
    "in_delivery",
    "at_mine",
    "completed",
    "cancelled",
  ],
  in_delivery: [
    "purchased",
    "at_warehouse",
    "at_mine",
    "completed",
    "cancelled",
  ],
  at_mine: [
    "purchased",
    "at_warehouse",
    "in_delivery",
    "completed",
    "cancelled",
  ],
  completed: [
    "purchased",
    "at_warehouse",
    "in_delivery",
    "at_mine",
    "cancelled",
  ],
  cancelled: [
    "purchased",
    "at_warehouse",
    "in_delivery",
    "at_mine",
    "completed",
  ],
};

export type PurchaseDocumentType = "invoice" | "payment_receipt";

export interface SupplierSearchResult {
  id: number;
  name: string;
  registration_number?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface PurchaseLineInput {
  orderItemId: number;
  quantity: number;
  unitPrice: number;
  currency?: string;
  vatAmount?: number;
  discountAmount?: number;
  notes?: string;
}

export interface CreateQuoteResult {
  success: boolean;
  quoteId?: number;
  error?: string;
}

export interface CreatePurchaseBatchResult {
  success: boolean;
  batchId?: number;
  error?: string;
}

export async function getOrderPurchaseBatches(
  orderId: string | number,
  canViewPrices?: boolean,
) {
  const numericOrderId = Number(orderId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_purchase_batches")
    .select(
      `
      id,
      order_id,
      quote_id,
      reference_number,
      purchased_at,
      paid_at,
      notes,
      created_at,
      order_suppliers (
        id,
        name,
        registration_number,
        phone,
        email
      ),
      order_purchase_quotes (
        id,
        quote_number,
        quote_date,
        order_suppliers (
          id,
          name,
          registration_number
        )
      ),
      order_purchase_documents (
        id,
        doc_type,
        file_name,
        mime_type,
        file_size,
        created_at
      ),
      order_purchase_lines (
        id,
        order_item_id,
        quantity,
        unit_price,
        currency,
        vat_amount,
        discount_amount,
        notes,
        created_at,
        order_items (
          id,
          part_name,
          part_number,
          unit
        ),
        order_fulfillment (
          id,
          purchase_line_id,
          quantity,
          status,
          created_at,
          notes,
          fulfillment_status_history (
            id,
            old_status,
            new_status,
            reason,
            created_at,
            profile:changed_by (
              name
            )
          )
        )
      )
    `,
    )
    .eq("order_id", numericOrderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return [];

  if (!canViewPrices) {
    const mapped = (data ?? []).map((batch) => ({
      ...batch,
      order_purchase_lines: batch.order_purchase_lines.map((line) => ({
        ...line,
        unit_price: null,
        vat_amount: null,
        discount_amount: null,
        currency: null,
      })),
    }));

    return mapped;
  }

  return data;
}

export async function getOrderPurchaseQuotes(orderId: string | number) {
  const numericOrderId = Number(orderId);
  await assertCanAccessOrderPurchase(numericOrderId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_purchase_quotes")
    .select(
      `
      id,
      order_id,
      supplier_id,
      quote_number,
      quote_date,
      valid_until,
      notes,
      created_at,
      order_suppliers (
        id,
        name,
        registration_number,
        phone,
        email
      ),
      order_purchase_quote_documents (
        id,
        file_name,
        mime_type,
        file_size,
        created_at
      ),
      order_purchase_quote_lines (
        id,
        order_item_id,
        quantity,
        unit_price,
        currency,
        notes,
        order_items (
          id,
          part_name,
          part_number,
          unit
        )
      )
    `,
    )
    .eq("order_id", numericOrderId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeFileName(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w.\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "document"
  );
}

function getFiles(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function assertAllowedFile(file: File) {
  if (file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
    throw new Error(
      getFileTooLargeMessage(file.name, DOCUMENT_UPLOAD_MAX_BYTES),
    );
  }
  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    throw new Error(`${file.name} файл зөвшөөрөгдөх төрөл биш байна`);
  }
}

function parseLines(raw: string): PurchaseLineInput[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Барааны мөрүүд буруу format-тай байна");
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Дор хаяж нэг бараа сонгоно уу");
  }

  return value.map((line, index) => {
    const row = line as Record<string, unknown>;
    const orderItemId = Number(row.orderItemId);
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    const vatAmount = Number(row.vatAmount ?? 0);
    const discountAmount = Number(row.discountAmount ?? 0);
    const currency = String(row.currency ?? "MNT")
      .trim()
      .toUpperCase();

    if (!Number.isFinite(orderItemId) || orderItemId <= 0) {
      throw new Error(`${index + 1}-р мөрийн бараа буруу байна`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`${index + 1}-р мөрийн тоо хэмжээ буруу байна`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`${index + 1}-р мөрийн нэгж үнэ буруу байна`);
    }
    if (!currency) {
      throw new Error(`${index + 1}-р мөрийн валют хоосон байна`);
    }

    return {
      orderItemId,
      quantity,
      unitPrice,
      currency,
      vatAmount: Number.isFinite(vatAmount) ? vatAmount : 0,
      discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
      notes: typeof row.notes === "string" ? row.notes.trim() : "",
    };
  });
}

export async function searchOrderSuppliers(
  query: string,
): Promise<SupplierSearchResult[]> {
  const supabase = await createClient();
  const trimmed = query.trim().replace(/[%,()]/g, " ");

  if (trimmed.length < 2) return [];

  const { data, error } = await supabase
    .from("order_suppliers")
    .select("id, name, registration_number, phone, email")
    .eq("is_deleted", false)
    .or(`name.ilike.%${trimmed}%,registration_number.ilike.%${trimmed}%`)
    .order("name")
    .limit(8);

  if (error) {
    console.error("Error searching order suppliers:", error);
    return [];
  }

  return (data ?? []) as SupplierSearchResult[];
}

export async function createOrderSupplier(input: {
  name: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}): Promise<SupplierSearchResult> {
  const supabase = await createClient();
  const profileId = await getProfileIdFromAuthUserId();
  const name = input.name.trim();

  if (!name) throw new Error("Компанийн нэр оруулна уу");

  const { data, error } = await supabase
    .from("order_suppliers")
    .insert({
      name,
      registration_number: input.registrationNumber?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: profileId,
    })
    .select("id, name, registration_number, phone, email")
    .single();

  if (error) throw new Error(error.message);
  return data as SupplierSearchResult;
}

export async function createOrderPurchaseBatch(
  formData: FormData,
): Promise<CreatePurchaseBatchResult> {
  const supabase = await createClient();

  try {
    const orderId = Number(cleanText(formData.get("orderId")));
    const supplierId = Number(cleanText(formData.get("supplierId")));
    const quoteId = Number(cleanText(formData.get("quoteId")));
    const rawLines = cleanText(formData.get("lines"));
    const invoices = getFiles(formData, "invoices");
    const payments = getFiles(formData, "payments");
    const lines = parseLines(rawLines);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      throw new Error("Захиалга тодорхойгүй байна");
    }
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      throw new Error("Нийлүүлэгч компани сонгоно уу");
    }
    if (invoices.length === 0 || payments.length === 0) {
      throw new Error("Нэхэмжлэх болон төлбөр төлсөн баримт заавал хавсаргана");
    }

    for (const file of [...invoices, ...payments]) {
      assertAllowedFile(file);
    }

    await assertCanAccessOrderPurchase(orderId);

    let linkedQuoteId: number | null = null;
    if (Number.isFinite(quoteId) && quoteId > 0) {
      const { data: quote, error: quoteError } = await supabase
        .from("order_purchase_quotes")
        .select("id, order_id, supplier_id")
        .eq("id", quoteId)
        .single();

      if (
        quoteError ||
        !quote ||
        Number(quote.order_id) !== orderId ||
        Number(quote.supplier_id) !== supplierId
      ) {
        throw new Error("Холбох үнийн санал олдсонгүй");
      }

      linkedQuoteId = Number(quote.id);
    }

    await Promise.all(
      Array.from(new Set(lines.map((line) => line.orderItemId))).map((id) =>
        assertCanAccessOrderItemPurchase(id),
      ),
    );

    const profileId = await getProfileIdFromAuthUserId();
    const lineItemIds = Array.from(
      new Set(lines.map((line) => line.orderItemId)),
    );
    const { data: orderItems, error: itemError } = await supabase
      .from("order_items")
      .select(
        `
        id,
        order_id,
        part_name,
        part_number,
        quantity,
        final_quantity,
        order_purchase_lines (
          quantity
        )
      `,
      )
      .in("id", lineItemIds);

    if (itemError) throw new Error(itemError.message);

    const itemMap = new Map(
      (orderItems ?? []).map((item) => [Number(item.id), item]),
    );

    for (const line of lines) {
      const item = itemMap.get(line.orderItemId);
      if (!item || Number(item.order_id) !== orderId) {
        throw new Error(
          "Purchase line-ийн бараа энэ захиалгад хамаарахгүй байна",
        );
      }

      const targetQuantity = Number(item.final_quantity ?? item.quantity ?? 0);
      const purchasedQuantity = (
        (item.order_purchase_lines ?? []) as Array<{
          quantity?: number | string | null;
        }>
      ).reduce((sum, purchaseLine) => {
        return sum + Number(purchaseLine.quantity ?? 0);
      }, 0);

      const remainingQuantity = Math.max(0, targetQuantity - purchasedQuantity);

      if (line.quantity > remainingQuantity) {
        const itemLabel = `${item.part_name ?? "Бараа"}${
          item.part_number ? ` (${item.part_number})` : ""
        }`;
        throw new Error(
          `${itemLabel}-ийн худалдан авах тоо үлдэгдлээс хэтэрлээ. Үлдэгдэл: ${remainingQuantity}`,
        );
      }
    }

    const { data: batch, error: batchError } = await supabase
      .from("order_purchase_batches")
      .insert({
        order_id: orderId,
        supplier_id: supplierId,
        quote_id: linkedQuoteId,
        reference_number: cleanText(formData.get("referenceNumber")) || null,
        purchased_at: cleanText(formData.get("purchasedAt")) || undefined,
        paid_at: cleanText(formData.get("paidAt")) || null,
        notes: cleanText(formData.get("notes")) || null,
        created_by: profileId,
      })
      .select("id")
      .single();

    if (batchError) throw new Error(batchError.message);

    const documentRows = [];
    for (const [docType, files] of [
      ["invoice", invoices],
      ["payment_receipt", payments],
    ] as const) {
      for (const file of files) {
        const safeName = sanitizeFileName(file.name);
        const storagePath = `${orderId}/${batch.id}/${docType}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(PURCHASE_DOCUMENT_BUCKET)
          .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError)
          throw new Error(`Файл хуулахад алдаа: ${uploadError.message}`);

        documentRows.push({
          purchase_batch_id: batch.id,
          doc_type: docType,
          bucket: PURCHASE_DOCUMENT_BUCKET,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
        });
      }
    }

    const { error: documentError } = await supabase
      .from("order_purchase_documents")
      .insert(documentRows);

    if (documentError) throw new Error(documentError.message);

    const { data: insertedLines, error: lineError } = await supabase
      .from("order_purchase_lines")
      .insert(
        lines.map((line) => ({
          purchase_batch_id: batch.id,
          order_item_id: line.orderItemId,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          currency: line.currency ?? "MNT",
          vat_amount: line.vatAmount ?? 0,
          discount_amount: line.discountAmount ?? 0,
          notes: line.notes || null,
        })),
      )
      .select("id, order_item_id, quantity");

    if (lineError) throw new Error(lineError.message);

    const { data: insertedFulfillments, error: fulfillmentError } =
      await supabase
        .from("order_fulfillment")
        .insert(
          (insertedLines ?? []).map((line) => ({
            order_item_id: line.order_item_id,
            purchase_line_id: line.id,
            quantity: line.quantity,
            status: "purchased",
            notes: "Худалдан авалт бүртгэв",
          })),
        )
        .select("id, quantity");

    if (fulfillmentError) throw new Error(fulfillmentError.message);

    const { error: fulfillmentHistoryError } = await supabase
      .from("fulfillment_status_history")
      .insert(
        (insertedFulfillments ?? []).map((fulfillment) => ({
          fulfillment_id: fulfillment.id,
          old_status: null,
          new_status: "purchased",
          reason: "Худалдан авалт бүртгэв",
          changed_by: profileId,
        })),
      );

    if (fulfillmentHistoryError)
      throw new Error(fulfillmentHistoryError.message);

    revalidatePath(`/orders/${orderId}/imp`);
    revalidatePath("/orders/purchase");

    return { success: true, batchId: Number(batch.id) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Алдаа гарлаа",
    };
  }
}

export async function createOrderPurchaseQuote(
  formData: FormData,
): Promise<CreateQuoteResult> {
  const supabase = await createClient();

  try {
    const orderId = Number(cleanText(formData.get("orderId")));
    const supplierId = Number(cleanText(formData.get("supplierId")));
    const rawLines = cleanText(formData.get("lines"));
    const files = getFiles(formData, "quoteFiles");
    const lines = parseLines(rawLines);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      throw new Error("Захиалга тодорхойгүй байна");
    }
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      throw new Error("Нийлүүлэгч компани сонгоно уу");
    }

    for (const file of files) {
      assertAllowedFile(file);
    }

    await assertCanAccessOrderPurchase(orderId);
    await Promise.all(
      Array.from(new Set(lines.map((line) => line.orderItemId))).map((id) =>
        assertCanAccessOrderItemPurchase(id),
      ),
    );

    const lineItemIds = Array.from(
      new Set(lines.map((line) => line.orderItemId)),
    );
    const { data: orderItems, error: itemError } = await supabase
      .from("order_items")
      .select("id, order_id")
      .in("id", lineItemIds);

    if (itemError) throw new Error(itemError.message);

    const invalidItem = (orderItems ?? []).find(
      (item) => Number(item.order_id) !== orderId,
    );
    if (invalidItem || (orderItems ?? []).length !== lineItemIds.length) {
      throw new Error("Үнийн саналын бараа энэ захиалгад хамаарахгүй байна");
    }

    const profileId = await getProfileIdFromAuthUserId();
    const { data: quote, error: quoteError } = await supabase
      .from("order_purchase_quotes")
      .insert({
        order_id: orderId,
        supplier_id: supplierId,
        quote_number: cleanText(formData.get("quoteNumber")) || null,
        quote_date: cleanText(formData.get("quoteDate")) || undefined,
        notes: cleanText(formData.get("notes")) || null,
        created_by: profileId,
      })
      .select("id")
      .single();

    if (quoteError) throw new Error(quoteError.message);

    if (files.length > 0) {
      const documentRows = [];
      for (const file of files) {
        const safeName = sanitizeFileName(file.name);
        const storagePath = `${orderId}/${quote.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(PURCHASE_QUOTE_BUCKET)
          .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Файл хуулахад алдаа: ${uploadError.message}`);
        }

        documentRows.push({
          quote_id: quote.id,
          bucket: PURCHASE_QUOTE_BUCKET,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
        });
      }

      const { error: documentError } = await supabase
        .from("order_purchase_quote_documents")
        .insert(documentRows);

      if (documentError) throw new Error(documentError.message);
    }

    const { error: lineError } = await supabase
      .from("order_purchase_quote_lines")
      .insert(
        lines.map((line) => ({
          quote_id: quote.id,
          order_item_id: line.orderItemId,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          currency: line.currency ?? "MNT",
          notes: line.notes || null,
        })),
      );

    if (lineError) throw new Error(lineError.message);

    revalidatePath(`/orders/${orderId}/imp`);
    return { success: true, quoteId: Number(quote.id) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Алдаа гарлаа",
    };
  }
}

export async function transitionPurchaseFulfillmentChunk(input: {
  fulfillmentId: number;
  orderId: number;
  status: string;
  quantity: number;
  note?: string;
}) {
  const supabase = await createClient();
  await assertCanAccessOrderPurchase(input.orderId);

  const nextStatus = input.status.trim();
  const quantity = Number(input.quantity);

  if (!MOVEMENT_STATUSES.has(nextStatus)) {
    throw new Error("Статус буруу байна");
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Зөв тоо хэмжээ оруулна уу");
  }

  const { data: fulfillment, error: fulfillmentError } = await supabase
    .from("order_fulfillment")
    .select(
      `
      id,
      order_item_id,
      purchase_line_id,
      quantity,
      status,
      order_items (
        order_id
      ),
      order_purchase_lines (
        id,
        order_purchase_batches (
          order_id
        )
      )
    `,
    )
    .eq("id", input.fulfillmentId)
    .single();

  const orderItem = Array.isArray(fulfillment?.order_items)
    ? fulfillment?.order_items[0]
    : fulfillment?.order_items;
  const purchaseLine = Array.isArray(fulfillment?.order_purchase_lines)
    ? fulfillment?.order_purchase_lines[0]
    : fulfillment?.order_purchase_lines;
  const batch = Array.isArray(purchaseLine?.order_purchase_batches)
    ? purchaseLine?.order_purchase_batches[0]
    : purchaseLine?.order_purchase_batches;
  const ownerOrderId = Number(batch?.order_id ?? orderItem?.order_id);

  if (
    fulfillmentError ||
    !fulfillment ||
    ownerOrderId !== Number(input.orderId)
  ) {
    throw new Error("Биелэлтийн мөр олдсонгүй");
  }

  const currentStatus = String(fulfillment.status);
  if (!NEXT_FULFILLMENT_STATUS[currentStatus]?.includes(nextStatus)) {
    throw new Error("Энэ төлөв рүү шууд шилжүүлэх боломжгүй байна");
  }

  const fulfillmentQuantity = Number(fulfillment.quantity);
  if (quantity > fulfillmentQuantity) {
    throw new Error(
      `Шилжүүлэх тоо мөрийн үлдэгдлээс хэтэрлээ. Үлдэгдэл: ${fulfillmentQuantity}`,
    );
  }

  const profileId = await getProfileIdFromAuthUserId();
  const note = input.note?.trim() || null;

  if (quantity === fulfillmentQuantity) {
    const { error: updateError } = await supabase
      .from("order_fulfillment")
      .update({ status: nextStatus })
      .eq("id", input.fulfillmentId);

    if (updateError) throw new Error(updateError.message);

    const { error: historyError } = await supabase
      .from("fulfillment_status_history")
      .insert({
        fulfillment_id: input.fulfillmentId,
        old_status: currentStatus,
        new_status: nextStatus,
        reason: note,
        changed_by: profileId,
      });

    if (historyError) throw new Error(historyError.message);
  } else {
    const remainingQuantity = fulfillmentQuantity - quantity;
    const { error: updateError } = await supabase
      .from("order_fulfillment")
      .update({ quantity: remainingQuantity })
      .eq("id", input.fulfillmentId);

    if (updateError) throw new Error(updateError.message);

    const { data: newFulfillment, error: insertError } = await supabase
      .from("order_fulfillment")
      .insert({
        order_item_id: fulfillment.order_item_id,
        purchase_line_id: fulfillment.purchase_line_id,
        quantity,
        status: nextStatus,
        notes: note,
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);

    const { error: historyError } = await supabase
      .from("fulfillment_status_history")
      .insert({
        fulfillment_id: newFulfillment.id,
        old_status: currentStatus,
        new_status: nextStatus,
        reason: note,
        changed_by: profileId,
      });

    if (historyError) throw new Error(historyError.message);
  }

  revalidatePath(`/orders/${input.orderId}/imp`);
  revalidatePath("/orders/purchase");

  return { success: true };
}

export async function getOrderPurchaseDocumentUrl(documentId: string) {
  const supabase = await createClient();
  const { data: document, error } = await supabase
    .from("order_purchase_documents")
    .select("bucket, storage_path, order_purchase_batches(order_id)")
    .eq("id", documentId)
    .single();

  const batch = Array.isArray(document?.order_purchase_batches)
    ? document?.order_purchase_batches[0]
    : document?.order_purchase_batches;

  if (error || !document || !batch?.order_id) {
    throw new Error("Баримт олдсонгүй");
  }

  await assertCanAccessOrderPurchase(Number(batch.order_id));

  const { data, error: signedError } = await supabase.storage
    .from(document.bucket)
    .createSignedUrl(document.storage_path, 300);

  if (signedError) throw new Error(signedError.message);
  return data.signedUrl;
}

export async function getOrderPurchaseQuoteDocumentUrl(documentId: string) {
  const supabase = await createClient();
  const { data: document, error } = await supabase
    .from("order_purchase_quote_documents")
    .select("bucket, storage_path, order_purchase_quotes(order_id)")
    .eq("id", documentId)
    .single();

  const quote = Array.isArray(document?.order_purchase_quotes)
    ? document?.order_purchase_quotes[0]
    : document?.order_purchase_quotes;

  if (error || !document || !quote?.order_id) {
    throw new Error("Үнийн саналын файл олдсонгүй");
  }

  await assertCanAccessOrderPurchase(Number(quote.order_id));

  const { data, error: signedError } = await supabase.storage
    .from(document.bucket)
    .createSignedUrl(document.storage_path, 300);

  if (signedError) throw new Error(signedError.message);
  return data.signedUrl;
}

export async function getOrderSupplierPurchaseReport() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_purchase_lines")
    .select(
      `
      id,
      quantity,
      unit_price,
      currency,
      vat_amount,
      discount_amount,
      order_items(id, part_name, part_number, unit),
      order_purchase_batches(
        id,
        purchased_at,
        reference_number,
        orders(id, order_number, title),
        order_suppliers(id, name, registration_number),
        order_purchase_documents(id, doc_type)
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
