import { createClient } from "@/utils/supabase/server";
import type { PolicyScopeTarget } from "@/types/types";
import type { ActionType } from "@/types/types";

type ClausePositionInput = {
  positionId?: string | null;
  job_position_id?: string | null;
  type?: ActionType | string | null;
};

export type PolicyDocumentClauseInput = {
  id?: string;
  referenceNumber: string;
  text: string;
  sectionId?: string;
  parentId?: string | null;
  positions?: ClausePositionInput[];
  children?: PolicyDocumentClauseInput[];
};

export type PolicyDocumentSectionInput = {
  id?: string;
  referenceNumber: string;
  text: string;
  clauses: PolicyDocumentClauseInput[];
};

export type SavePolicyDocumentInput = {
  name: string;
  reference_code: string;
  approved_date: string | Date | null;
  scope_targets?: PolicyScopeTarget[];
  sections: PolicyDocumentSectionInput[];
};

type ExistingIdRow = { id: string };

type FlatClause = {
  localKey: string;
  id?: string;
  sectionKey: string;
  parentKey: string | null;
  referenceNumber: string;
  text: string;
  depth: number;
  positions: ClausePositionInput[];
};

function formatApprovedDate(value: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeScopeTargets(scopeTargets?: PolicyScopeTarget[]) {
  return Array.from(
    new Map(
      (scopeTargets ?? [])
        .filter((target) => target.target_type && target.target_bteg_id)
        .map((target) => [
          `${target.target_type}:${target.target_bteg_id}`,
          target,
        ]),
    ).values(),
  );
}

function flattenClauses(
  clauses: PolicyDocumentClauseInput[],
  sectionKey: string,
  parentKey: string | null = null,
  depth = 0,
  path: number[] = [],
): FlatClause[] {
  return clauses.flatMap((clause, index) => {
    const currentPath = [...path, index];
    const localKey = clause.id ?? `new-clause:${sectionKey}:${currentPath.join(".")}`;
    const current: FlatClause = {
      localKey,
      id: clause.id,
      sectionKey,
      parentKey,
      referenceNumber: clause.referenceNumber,
      text: clause.text,
      depth,
      positions: clause.positions ?? [],
    };

    return [
      current,
      ...flattenClauses(
        clause.children ?? [],
        sectionKey,
        localKey,
        depth + 1,
        currentPath,
      ),
    ];
  });
}

function requireMappedId(
  map: Map<string, string>,
  key: string,
  label: string,
) {
  const id = map.get(key);
  if (!id) throw new Error(`${label} ID олдсонгүй`);
  return id;
}

export async function savePolicyDocument(
  policyId: string,
  input: SavePolicyDocumentInput,
) {
  if (!input.name || !input.reference_code) {
    throw new Error("Журмын нэр болон дугаар заавал оруулна уу");
  }

  const supabase = await createClient();
  const approvedDate = formatApprovedDate(input.approved_date);

  const { data: duplicatePolicy, error: duplicateError } = await supabase
    .from("policy")
    .select("id")
    .eq("reference_code", input.reference_code)
    .eq("is_deleted", false)
    .neq("id", policyId)
    .limit(1)
    .maybeSingle();

  if (duplicateError) throw duplicateError;
  if (duplicatePolicy) throw new Error("Журмын код бүртгэлтэй байна");

  const { data: policy, error: policyError } = await supabase
    .from("policy")
    .update({
      name: input.name,
      reference_code: input.reference_code,
      approved_date: approvedDate,
    })
    .eq("id", policyId)
    .eq("is_deleted", false)
    .select("id")
    .single();

  if (policyError) throw policyError;

  const scopeTargets = normalizeScopeTargets(input.scope_targets);
  const { error: deleteScopeError } = await supabase
    .from("policy_scope_targets")
    .delete()
    .eq("policy_id", policyId);

  if (deleteScopeError) throw deleteScopeError;

  if (scopeTargets.length > 0) {
    const { error: scopeError } = await supabase
      .from("policy_scope_targets")
      .insert(
        scopeTargets.map((target) => ({
          policy_id: policyId,
          target_type: target.target_type,
          target_bteg_id: target.target_bteg_id,
          target_name: target.target_name ?? null,
          parent_bteg_id: target.parent_bteg_id ?? null,
        })),
      );

    if (scopeError) throw scopeError;
  }

  const { data: existingSections, error: existingSectionsError } =
    await supabase
      .from("section")
      .select("id")
      .eq("policy_id", policyId)
      .eq("is_deleted", false);

  if (existingSectionsError) throw existingSectionsError;

  const existingSectionIds = new Set(
    ((existingSections ?? []) as ExistingIdRow[]).map((section) => section.id),
  );
  const incomingExistingSectionIds = input.sections
    .map((section) => section.id)
    .filter((id): id is string => Boolean(id));
  const incomingSectionIdSet = new Set(incomingExistingSectionIds);
  const deletedSectionIds = Array.from(existingSectionIds).filter(
    (id) => !incomingSectionIdSet.has(id),
  );

  if (deletedSectionIds.length > 0) {
    const { error: deleteSectionError } = await supabase
      .from("section")
      .update({ is_deleted: true })
      .in("id", deletedSectionIds);

    if (deleteSectionError) throw deleteSectionError;
  }

  const existingSectionUpdates = input.sections.filter((section) => section.id);
  if (existingSectionUpdates.length > 0) {
    const { error: sectionUpdateError } = await supabase.from("section").upsert(
      existingSectionUpdates.map((section) => ({
        id: section.id,
        policy_id: policyId,
        reference_number: section.referenceNumber,
        text: section.text,
        is_deleted: false,
      })),
      { onConflict: "id" },
    );

    if (sectionUpdateError) throw sectionUpdateError;
  }

  const sectionIdByKey = new Map<string, string>();
  input.sections.forEach((section, index) => {
    if (section.id) sectionIdByKey.set(section.id, section.id);
    else sectionIdByKey.set(`new-section:${index}`, "");
  });

  const newSections = input.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => !section.id);

  if (newSections.length > 0) {
    const { data: insertedSections, error: sectionInsertError } =
      await supabase
        .from("section")
        .insert(
          newSections.map(({ section }) => ({
            policy_id: policyId,
            reference_number: section.referenceNumber,
            text: section.text,
            is_deleted: false,
          })),
        )
        .select("id");

    if (sectionInsertError) throw sectionInsertError;

    (insertedSections ?? []).forEach((section: ExistingIdRow, index) => {
      sectionIdByKey.set(`new-section:${newSections[index].index}`, section.id);
    });
  }

  const sectionKeyByIndex = input.sections.map((section, index) =>
    section.id ?? `new-section:${index}`,
  );
  const flatClauses = input.sections.flatMap((section, index) =>
    flattenClauses(section.clauses ?? [], sectionKeyByIndex[index]),
  );
  const incomingExistingClauseIds = flatClauses
    .map((clause) => clause.id)
    .filter((id): id is string => Boolean(id));

  const { data: existingClauses, error: existingClauseError } = await supabase
    .from("clause")
    .select("id")
    .eq("policy_id", policyId)
    .eq("is_deleted", false);

  if (existingClauseError) throw existingClauseError;

  const incomingClauseIdSet = new Set(incomingExistingClauseIds);
  const deletedClauseIds = ((existingClauses ?? []) as ExistingIdRow[])
    .map((clause) => clause.id)
    .filter((id) => !incomingClauseIdSet.has(id));

  if (deletedClauseIds.length > 0) {
    const { error: deleteClauseError } = await supabase
      .from("clause")
      .update({ is_deleted: true })
      .in("id", deletedClauseIds);

    if (deleteClauseError) throw deleteClauseError;
  }

  const clauseIdByKey = new Map<string, string>();
  flatClauses.forEach((clause) => {
    if (clause.id) clauseIdByKey.set(clause.localKey, clause.id);
  });

  const maxDepth = flatClauses.reduce(
    (max, clause) => Math.max(max, clause.depth),
    -1,
  );

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const clausesAtDepth = flatClauses.filter((clause) => clause.depth === depth);
    const existingClauseUpdates = clausesAtDepth.filter((clause) => clause.id);

    if (existingClauseUpdates.length > 0) {
      const { error: clauseUpdateError } = await supabase.from("clause").upsert(
        existingClauseUpdates.map((clause) => ({
          id: clause.id,
          text: clause.text,
          reference_number: clause.referenceNumber,
          section_id: requireMappedId(
            sectionIdByKey,
            clause.sectionKey,
            "Бүлгийн",
          ),
          parent_id: clause.parentKey
            ? requireMappedId(clauseIdByKey, clause.parentKey, "Эцэг заалтын")
            : null,
          policy_id: policyId,
          is_deleted: false,
        })),
        { onConflict: "id" },
      );

      if (clauseUpdateError) throw clauseUpdateError;
    }

    const newClauses = clausesAtDepth.filter((clause) => !clause.id);
    if (newClauses.length > 0) {
      const { data: insertedClauses, error: clauseInsertError } =
        await supabase
          .from("clause")
          .insert(
            newClauses.map((clause) => ({
              text: clause.text,
              reference_number: clause.referenceNumber,
              section_id: requireMappedId(
                sectionIdByKey,
                clause.sectionKey,
                "Бүлгийн",
              ),
              parent_id: clause.parentKey
                ? requireMappedId(
                    clauseIdByKey,
                    clause.parentKey,
                    "Эцэг заалтын",
                  )
                : null,
              policy_id: policyId,
              is_deleted: false,
            })),
          )
          .select("id");

      if (clauseInsertError) throw clauseInsertError;

      (insertedClauses ?? []).forEach((clause: ExistingIdRow, index) => {
        clauseIdByKey.set(newClauses[index].localKey, clause.id);
      });
    }
  }

  const savedClauseIds = Array.from(clauseIdByKey.values());
  if (savedClauseIds.length > 0) {
    const { error: deletePositionError } = await supabase
      .from("clause_job_position")
      .delete()
      .in("clause_id", savedClauseIds);

    if (deletePositionError) throw deletePositionError;
  }

  const clausePositions = flatClauses.flatMap((clause) => {
    const clauseId = clauseIdByKey.get(clause.localKey);
    if (!clauseId) return [];

    return (clause.positions ?? [])
      .map((position) => ({
        clause_id: clauseId,
        position_id: position.positionId ?? position.job_position_id,
        type: position.type,
      }))
      .filter((position) => position.position_id && position.type);
  });

  if (clausePositions.length > 0) {
    const { error: positionInsertError } = await supabase
      .from("clause_job_position")
      .insert(clausePositions);

    if (positionInsertError) throw positionInsertError;
  }

  return {
    id: policy.id,
    sectionCount: input.sections.length,
    clauseCount: flatClauses.length,
  };
}
