import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/actions/rbac";
import { getProfileIdFromAuthUserId } from "@/actions/profile";
import { createClient } from "@/utils/supabase/server";
import type {
  LegalActCreateTarget,
  LegalActType,
} from "@/actions/policy-legal-acts";
import { normalizeRevisionChangeAction } from "@/lib/policy-revision-actions";
import {
  DOCUMENT_UPLOAD_MAX_BYTES,
  LEGAL_ACT_ALLOWED_MIME_TYPES,
  getFileTooLargeMessage,
} from "@/lib/file-upload-limits";

const BUCKET = "policy-legal-acts";
const ALLOWED_MIME_TYPES = new Set<String>(LEGAL_ACT_ALLOWED_MIME_TYPES);

function sanitizeFileName(name: string) {
  const clean = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || "attachment";
}

function parseTargets(
  value: FormDataEntryValue | null,
): LegalActCreateTarget[] {
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function validateFile(file: File | null) {
  if (!file || file.size === 0) return null;
  if (file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
    throw new Error(
      getFileTooLargeMessage(file.name, DOCUMENT_UPLOAD_MAX_BYTES),
    );
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Зөвхөн PDF, зураг эсвэл Word document хавсаргана уу");
  }
  return file;
}

export async function POST(request: Request) {
  try {
    const canCreate = await hasPermission("policy", "create");
    if (!canCreate) {
      return NextResponse.json(
        { error: "Эрх зүйн акт үүсгэх эрхгүй байна" },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const actType = String(formData.get("act_type") ?? "") as LegalActType;
    const actNumber = String(formData.get("act_number") ?? "").trim();
    const actDate = String(formData.get("act_date") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const bodyText = String(formData.get("body_text") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const policyId = String(formData.get("policy_id") ?? "").trim();
    const summary = String(formData.get("summary") ?? "").trim();
    const revisionTargets = parseTargets(formData.get("revision_targets"));
    const file = validateFile(formData.get("attachment") as File | null);

    if (actType !== "03" && actType !== "04") {
      throw new Error("Тушаалын төрөл буруу байна");
    }
    if (!actNumber || !actDate || !title) {
      throw new Error("Тушаалын дугаар, огноо, гарчиг заавал оруулна уу");
    }
    if (actType === "04" && (!policyId || revisionTargets.length === 0)) {
      throw new Error(
        "04 тушаалд журам болон шинэчлэгдсэн target заавал сонгоно уу",
      );
    }

    const supabase = await createClient();
    const profileId = await getProfileIdFromAuthUserId();
    const { data: legalAct, error: actError } = await supabase
      .from("legal_acts")
      .insert({
        act_type: actType,
        act_number: actNumber,
        act_date: actDate,
        title,
        body_text: bodyText || null,
        notes: notes || null,
        created_by: profileId,
        is_deleted: false,
      })
      .select("id")
      .single();

    if (actError)
      throw new Error(`Эрх зүйн акт үүсгэхэд алдаа: ${actError.message}`);

    if (file) {
      const safeName = sanitizeFileName(file.name);
      const storagePath = `${legalAct.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError)
        throw new Error(`Файл хуулахад алдаа: ${uploadError.message}`);

      const { error: attachmentError } = await supabase
        .from("legal_act_attachments")
        .insert({
          legal_act_id: legalAct.id,
          bucket: BUCKET,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
        });

      if (attachmentError) {
        throw new Error(
          `Хавсралтын metadata хадгалахад алдаа: ${attachmentError.message}`,
        );
      }
    }

    if (actType === "04") {
      const { data: revision, error: revisionError } = await supabase
        .from("policy_revisions")
        .insert({
          legal_act_id: legalAct.id,
          policy_id: policyId,
          summary: summary || null,
        })
        .select("id")
        .single();

      if (revisionError) {
        throw new Error(
          `Журмын шинэчлэл хадгалахад алдаа: ${revisionError.message}`,
        );
      }

      const targetRows = revisionTargets.map((target) => ({
        policy_revision_id: revision.id,
        target_type: target.targetType,
        change_action: normalizeRevisionChangeAction(target.changeAction),
        policy_id: target.policyId ?? policyId,
        section_id: target.sectionId ?? null,
        clause_id: target.clauseId ?? null,
        change_note: target.changeNote?.trim() || null,
      }));

      const { error: targetError } = await supabase
        .from("policy_revision_targets")
        .insert(targetRows);

      if (targetError) {
        throw new Error(
          `Шинэчлэгдсэн target хадгалахад алдаа: ${targetError.message}`,
        );
      }
    }

    revalidatePath("/policy/legal-acts");
    revalidatePath(`/policy/legal-acts/${legalAct.id}`);
    if (policyId) revalidatePath(`/policy/${policyId}`);

    return NextResponse.json({ id: legalAct.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
