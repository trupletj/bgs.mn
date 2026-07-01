"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { hasPermission } from "@/actions/rbac";
import { sortByReferenceNumber } from "@/lib/policy-utils";
import {
  normalizeRevisionChangeAction,
  type RevisionChangeAction,
} from "@/lib/policy-revision-actions";
export type { RevisionChangeAction } from "@/lib/policy-revision-actions";

export type LegalActType = "03" | "04";
export type RevisionTargetType = "policy" | "section" | "clause";

export interface LegalActAttachment {
  id: string;
  legal_act_id: string;
  bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface LegalActListItem {
  id: string;
  act_type: LegalActType;
  act_number: string;
  act_date: string;
  title: string;
  body_text: string | null;
  notes: string | null;
  created_at: string;
  revision_count: number;
  attachment_count: number;
  policies: {
    id: string;
    name: string | null;
    reference_code: string | null;
  }[];
}

export interface LegalActRevisionTarget {
  id: string;
  target_type: RevisionTargetType;
  change_action: RevisionChangeAction;
  policy_id: string | null;
  section_id: string | null;
  clause_id: string | null;
  change_note: string | null;
  section?: {
    id: string;
    reference_number: string | null;
    text: string | null;
  } | null;
  clause?: {
    id: string;
    reference_number: string | null;
    text: string | null;
  } | null;
}

export interface LegalActRevision {
  id: string;
  legal_act_id: string;
  policy_id: string;
  summary: string | null;
  policy?: {
    id: string;
    name: string | null;
    reference_code: string | null;
  } | null;
  targets: LegalActRevisionTarget[];
}

export interface LegalActDetail {
  id: string;
  act_type: LegalActType;
  act_number: string;
  act_date: string;
  title: string;
  body_text: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  attachments: LegalActAttachment[];
  revisions: LegalActRevision[];
}

export interface RevisionMarker {
  target_type: RevisionTargetType;
  change_action: RevisionChangeAction;
  policy_id: string | null;
  section_id: string | null;
  clause_id: string | null;
  change_note: string | null;
  legal_act: {
    id: string;
    act_type: LegalActType;
    act_number: string;
    act_date: string;
    title: string;
  };
}

export interface PolicyPickerClause {
  id: string;
  reference_number: string;
  text: string;
}

export interface PolicyPickerSection {
  id: string;
  reference_number: string;
  text: string;
  clauses: PolicyPickerClause[];
}

export interface PolicyPickerPolicy {
  id: string;
  name: string;
  reference_code: string | null;
  sections: PolicyPickerSection[];
}

export interface LegalActCreateTarget {
  targetType: RevisionTargetType;
  changeAction?: RevisionChangeAction | null;
  policyId?: string | null;
  sectionId?: string | null;
  clauseId?: string | null;
  changeNote?: string | null;
}

interface LegalActListPolicyRow {
  id: string;
  name: string | null;
  reference_code: string | null;
}

interface LegalActListRevisionRow {
  policy: LegalActListPolicyRow | LegalActListPolicyRow[] | null;
}

interface LegalActListRow {
  id: string;
  act_type: LegalActType;
  act_number: string;
  act_date: string;
  title: string;
  body_text: string | null;
  notes: string | null;
  created_at: string;
  attachments?: { id: string }[] | null;
  revisions?: LegalActListRevisionRow[] | null;
}

interface LegalActRevisionRow {
  id: string;
  legal_act_id: string;
  policy_id: string;
  summary: string | null;
  policy: LegalActRevision["policy"] | LegalActRevision["policy"][] | null;
  targets?:
    | (Omit<LegalActRevisionTarget, "section" | "clause"> & {
        section?:
          | LegalActRevisionTarget["section"]
          | LegalActRevisionTarget["section"][]
          | null;
        clause?:
          | LegalActRevisionTarget["clause"]
          | LegalActRevisionTarget["clause"][]
          | null;
      })[]
    | null;
}

interface PolicyRevisionMarkerRevisionRow {
  id: string;
  legal_act: RevisionMarker["legal_act"] | RevisionMarker["legal_act"][] | null;
}

interface PolicyRevisionMarkerTargetRow {
  policy_revision_id: string;
  target_type: RevisionTargetType;
  change_action: RevisionChangeAction | null;
  policy_id: string | null;
  section_id: string | null;
  clause_id: string | null;
  change_note: string | null;
}

interface PolicyPickerClauseRow {
  id: string;
  reference_number: string | null;
  text: string | null;
  is_deleted: boolean | null;
}

interface PolicyPickerSectionRow {
  id: string;
  reference_number: string | null;
  text: string | null;
  is_deleted: boolean | null;
  clauses?: PolicyPickerClauseRow[] | null;
}

interface PolicyPickerPolicyRow {
  id: string;
  name: string | null;
  reference_code: string | null;
  sections?: PolicyPickerSectionRow[] | null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeLegalAct(row: LegalActListRow): LegalActListItem {
  const revisions = row.revisions ?? [];
  const policiesById = new Map<
    string,
    { id: string; name: string | null; reference_code: string | null }
  >();

  revisions.forEach((revision) => {
    const policy = Array.isArray(revision.policy)
      ? revision.policy[0]
      : revision.policy;
    if (policy?.id) {
      policiesById.set(policy.id, {
        id: policy.id,
        name: policy.name,
        reference_code: policy.reference_code,
      });
    }
  });

  return {
    id: row.id,
    act_type: row.act_type,
    act_number: row.act_number,
    act_date: row.act_date,
    title: row.title,
    body_text: row.body_text,
    notes: row.notes,
    created_at: row.created_at,
    revision_count: revisions.length,
    attachment_count: (row.attachments ?? []).length,
    policies: Array.from(policiesById.values()),
  };
}

export async function getLegalActTypeLabel(type: LegalActType) {
  if (type === "03") return "03 - Сахилгын шийтгэл";
  return "04 - Журам шинэчлэх";
}

export async function formatLegalActDate(value: string | null | undefined) {
  return formatDate(value);
}

export async function getLegalActs(type?: LegalActType | "all") {
  const canAccess = await hasPermission("policy", "access");
  if (!canAccess) return [];

  const supabase = await createClient();
  let query = supabase
    .from("legal_acts")
    .select(
      `
        id, act_type, act_number, act_date, title, body_text, notes, created_at,
        attachments:legal_act_attachments(id),
        revisions:policy_revisions(
          id,
          policy:policy_id(id, name, reference_code)
        )
      `,
    )
    .eq("is_deleted", false)
    .order("act_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (type && type !== "all") {
    query = query.eq("act_type", type);
  }

  const { data, error } = await query;
  if (error)
    throw new Error(`Эрх зүйн актын жагсаалт авахад алдаа: ${error.message}`);

  return ((data ?? []) as LegalActListRow[]).map(normalizeLegalAct);
}

export async function getLegalActDetail(
  id: string,
): Promise<LegalActDetail | null> {
  const canAccess = await hasPermission("policy", "access");
  if (!canAccess) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("legal_acts")
    .select(
      `
        id, act_type, act_number, act_date, title, body_text, notes, created_at, updated_at,
        attachments:legal_act_attachments(
          id, legal_act_id, bucket, storage_path, file_name, mime_type, file_size, created_at
        ),
        revisions:policy_revisions(
          id, legal_act_id, policy_id, summary,
          policy:policy_id(id, name, reference_code),
          targets:policy_revision_targets(
            id, target_type, change_action, policy_id, section_id, clause_id, change_note,
            section:section_id(id, reference_number, text),
            clause:clause_id(id, reference_number, text)
          )
        )
      `,
    )
    .eq("id", id)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) throw new Error(`Эрх зүйн акт авахад алдаа: ${error.message}`);
  if (!data) return null;

  return {
    ...data,
    attachments: data.attachments ?? [],
    revisions: ((data.revisions ?? []) as unknown as LegalActRevisionRow[]).map(
      (revision) => ({
        ...revision,
        policy: Array.isArray(revision.policy)
          ? revision.policy[0]
          : revision.policy,
        targets: (revision.targets ?? []).map((target) => ({
          ...target,
          change_action: normalizeRevisionChangeAction(target.change_action),
          section: Array.isArray(target.section)
            ? target.section[0]
            : target.section,
          clause: Array.isArray(target.clause)
            ? target.clause[0]
            : target.clause,
        })),
      }),
    ),
  } as LegalActDetail;
}

export async function getPolicyRevisionMarkers(policyId: string) {
  const canAccess = await hasPermission("policy", "access");
  if (!canAccess) return [];

  const supabase = await createClient();
  const { data: revisions, error: revisionError } = await supabase
    .from("policy_revisions")
    .select(
      `
        id,
        legal_act:legal_act_id(id, act_type, act_number, act_date, title)
      `,
    )
    .eq("policy_id", policyId);

  if (revisionError)
    throw new Error(`Журмын шинэчлэл авахад алдаа: ${revisionError.message}`);

  const revisionRows = (revisions ?? []) as PolicyRevisionMarkerRevisionRow[];
  const revisionIds = revisionRows.map((revision) => revision.id);
  if (revisionIds.length === 0) return [];

  const legalActByRevisionId = new Map<string, RevisionMarker["legal_act"]>();
  revisionRows.forEach((revision) => {
    const legalAct = Array.isArray(revision.legal_act)
      ? revision.legal_act[0]
      : revision.legal_act;
    if (legalAct) legalActByRevisionId.set(revision.id, legalAct);
  });

  const { data: targets, error: targetError } = await supabase
    .from("policy_revision_targets")
    .select(
      "policy_revision_id, target_type, change_action, policy_id, section_id, clause_id, change_note",
    )
    .in("policy_revision_id", revisionIds);

  if (targetError)
    throw new Error(
      `Журмын шинэчлэлийн target авахад алдаа: ${targetError.message}`,
    );

  return ((targets ?? []) as PolicyRevisionMarkerTargetRow[])
    .map((target) => {
      const legalAct = legalActByRevisionId.get(target.policy_revision_id);
      if (!legalAct) return null;
      return {
        target_type: target.target_type,
        change_action: normalizeRevisionChangeAction(target.change_action),
        policy_id: target.policy_id,
        section_id: target.section_id,
        clause_id: target.clause_id,
        change_note: target.change_note,
        legal_act: legalAct,
      };
    })
    .filter((target): target is RevisionMarker => Boolean(target));
}

export async function getPolicyPickerData(): Promise<PolicyPickerPolicy[]> {
  const [canCreate, canEdit] = await Promise.all([
    hasPermission("policy", "create"),
    hasPermission("policy", "edit"),
  ]);
  if (!canCreate && !canEdit) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("policy")
    .select(
      `
        id, name, reference_code,
        sections:section!policy_id(
          id, reference_number, text, is_deleted,
          clauses:clause!section_id(id, reference_number, text, is_deleted)
        )
      `,
    )
    .eq("is_deleted", false)
    .order("name");

  if (error) throw new Error(`Журмын сонголт авахад алдаа: ${error.message}`);

  return ((data ?? []) as PolicyPickerPolicyRow[]).map((policy) => {
    const sections = sortByReferenceNumber(
      (policy.sections ?? []).filter((section) => !section.is_deleted),
    ).map((section) => ({
      id: section.id,
      reference_number: section.reference_number ?? "",
      text: section.text ?? "",
      clauses: sortByReferenceNumber(
        (section.clauses ?? []).filter((clause) => !clause.is_deleted),
      ).map((clause) => ({
        id: clause.id,
        reference_number: clause.reference_number ?? "",
        text: clause.text ?? "",
      })),
    }));

    return {
      id: policy.id,
      name: policy.name ?? "Нэргүй",
      reference_code: policy.reference_code,
      sections,
    };
  });
}

export async function deleteLegalAct(formData: FormData) {
  const canDelete = await hasPermission("policy", "delete");
  if (!canDelete) throw new Error("Эрх зүйн акт устгах эрхгүй байна");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Эрх зүйн актын ID шаардлагатай");

  const supabase = await createClient();
  const { error } = await supabase
    .from("legal_acts")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) throw new Error(`Эрх зүйн акт устгахад алдаа: ${error.message}`);

  redirect("/policy/legal-acts");
}
