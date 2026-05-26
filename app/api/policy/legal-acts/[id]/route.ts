import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/actions/rbac";
import { getSupabaseAdmin } from "@/utils/supabase/supabaseAdmin";
import type { LegalActCreateTarget, LegalActType } from "@/actions/policy-legal-acts";
import { normalizeRevisionChangeAction } from "@/lib/policy-revision-actions";

const BUCKET = "policy-legal-acts";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function sanitizeFileName(name: string) {
  const clean = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || "attachment";
}

function parseTargets(value: FormDataEntryValue | null): LegalActCreateTarget[] {
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
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Файлын хэмжээ 20MB-аас их байна");
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Зөвхөн PDF, зураг эсвэл Word document хавсаргана уу");
  }
  return file;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const canEdit = await hasPermission("policy", "edit");
    if (!canEdit) {
      return NextResponse.json({ error: "Эрх зүйн акт засах эрхгүй байна" }, { status: 403 });
    }

    const { id } = await params;
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
      throw new Error("04 тушаалд журам болон шинэчлэгдсэн target заавал сонгоно уу");
    }

    const supabase = getSupabaseAdmin();
    const { data: existingRevisions, error: existingError } = await supabase
      .from("policy_revisions")
      .select("id, policy_id")
      .eq("legal_act_id", id);

    if (existingError) {
      throw new Error(`Одоогийн шинэчлэл авахад алдаа: ${existingError.message}`);
    }

    const previousPolicyIds = Array.from(
      new Set((existingRevisions ?? []).map((revision) => revision.policy_id)),
    );

    const { data: legalAct, error: actError } = await supabase
      .from("legal_acts")
      .update({
        act_type: actType,
        act_number: actNumber,
        act_date: actDate,
        title,
        body_text: bodyText || null,
        notes: notes || null,
      })
      .eq("id", id)
      .eq("is_deleted", false)
      .select("id")
      .single();

    if (actError || !legalAct) {
      throw new Error(actError?.message || "Эрх зүйн акт олдсонгүй");
    }

    if ((existingRevisions ?? []).length > 0) {
      const revisionIds = (existingRevisions ?? []).map((revision) => revision.id);
      const { error: targetDeleteError } = await supabase
        .from("policy_revision_targets")
        .delete()
        .in("policy_revision_id", revisionIds);

      if (targetDeleteError) {
        throw new Error(`Хуучин target устгахад алдаа: ${targetDeleteError.message}`);
      }

      const { error: revisionDeleteError } = await supabase
        .from("policy_revisions")
        .delete()
        .eq("legal_act_id", id);

      if (revisionDeleteError) {
        throw new Error(`Хуучин шинэчлэл устгахад алдаа: ${revisionDeleteError.message}`);
      }
    }

    if (file) {
      const safeName = sanitizeFileName(file.name);
      const storagePath = `${id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw new Error(`Файл хуулахад алдаа: ${uploadError.message}`);

      const { error: attachmentError } = await supabase
        .from("legal_act_attachments")
        .insert({
          legal_act_id: id,
          bucket: BUCKET,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
        });

      if (attachmentError) {
        throw new Error(`Хавсралтын metadata хадгалахад алдаа: ${attachmentError.message}`);
      }
    }

    if (actType === "04") {
      const { data: revision, error: revisionError } = await supabase
        .from("policy_revisions")
        .insert({
          legal_act_id: id,
          policy_id: policyId,
          summary: summary || null,
        })
        .select("id")
        .single();

      if (revisionError) {
        throw new Error(`Журмын шинэчлэл хадгалахад алдаа: ${revisionError.message}`);
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
        throw new Error(`Шинэчлэгдсэн target хадгалахад алдаа: ${targetError.message}`);
      }
    }

    revalidatePath("/policy/legal-acts");
    revalidatePath(`/policy/legal-acts/${id}`);
    previousPolicyIds.forEach((previousPolicyId) => {
      if (previousPolicyId) revalidatePath(`/policy/${previousPolicyId}`);
    });
    if (policyId) revalidatePath(`/policy/${policyId}`);

    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
