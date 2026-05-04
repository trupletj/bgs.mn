import { createClient } from "@/utils/supabase/client";
import { Policy, PolicyScopeTarget } from "@/types/types";
import { Clause as ClauseEdit } from "@/types/clause";

const supabase = createClient();

interface ClauseRow {
  id: string;
  text: string;
  reference_number: string | null;
  section_id: string;
  parent_id: string | null;
  policy_id: string | null;
  is_deleted: boolean | null;
  clause_position?: ClausePositionRow[];
}

interface ClausePositionRow {
  id?: string | number;
  clause_id: string;
  job_position_id?: string | null;
  type?: string | null;
}

async function savePolicyScopeTargets(
  policyId: string,
  scopeTargets?: PolicyScopeTarget[],
) {
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from("policy_scope_targets")
    .delete()
    .eq("policy_id", policyId);

  if (deleteError) throw deleteError;

  const uniqueTargets = Array.from(
    new Map(
      (scopeTargets ?? [])
        .filter((target) => target.target_type && target.target_bteg_id)
        .map((target) => [
          `${target.target_type}:${target.target_bteg_id}`,
          target,
        ]),
    ).values(),
  );

  if (uniqueTargets.length === 0) return;

  const { error: insertError } = await supabase
    .from("policy_scope_targets")
    .insert(
      uniqueTargets.map((target) => ({
        policy_id: policyId,
        target_type: target.target_type,
        target_bteg_id: target.target_bteg_id,
        target_name: target.target_name ?? null,
        parent_bteg_id: target.parent_bteg_id ?? null,
      })),
    );

  if (insertError) throw insertError;
}

export async function getPolicyById(policyId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("policy")
    .select("name, reference_code")
    .eq("id", policyId)
    .single();

  if (error) {
    console.error("Get policy error:", error);
    return null;
  }

  return data;
}

export async function createPolicy(policyData: Omit<Policy, "section">) {
  const supabase = createClient();

  if (policyData.reference_code) {
    const { data: existingPolicy } = await supabase
      .from("policy")
      .select("id")
      .eq("reference_code", policyData.reference_code)
      .eq("is_deleted", false)
      .single();

    if (existingPolicy) {
      throw new Error("Журмын код бүртгэлтэй байна");
    }
  }

  let approvedDate = null;
  if (policyData.approved_date) {
    const date = new Date(policyData.approved_date);
    approvedDate = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  const { data, error } = await supabase
    .from("policy")
    .insert([
      {
        name: policyData.name,
        reference_code: policyData.reference_code,
        approved_date: approvedDate,
        is_deleted: false,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Create policy error:", error);
    throw error;
  }

  await savePolicyScopeTargets(data.id, policyData.scope_targets);

  return data;
}

// export const updatePolicy = async (
//   id: string,
//   data: Partial<{
//     name: string;
//     reference_code: string;
//     approved_date: string | null;
//   }>
// ) => {
//   try {
//     // Reference code давхцал шалгах
//     if (data.reference_code) {
//       const { data: existingPolicy, error: checkError } = await supabase
//         .from("policy")
//         .select("id")
//         .eq("reference_code", data.reference_code)
//         .eq("is_deleted", false)
//         .single();

//       if (existingPolicy && existingPolicy.id !== id) {
//         throw new Error("Журмын код бүртгэлтэй байна");
//       }
//     }

//     const updateData: any = {};
//     if (data.name !== undefined) updateData.name = data.name;
//     if (data.reference_code !== undefined)
//       updateData.reference_code = data.reference_code;
//     if (data.approved_date !== undefined)
//       updateData.approved_date = data.approved_date;

//     const { data: policy, error } = await supabase
//       .from("policy")
//       .update(updateData)
//       .eq("id", id)
//       .eq("is_deleted", false)
//       .select()
//       .single();

//     if (error) throw error;
//     return policy;
//   } catch (error) {
//     throw new Error(`Журам засахад алдаа гарлаа: ${(error as Error).message}`);
//   }
// };

export const deletePolicy = async (id: string) => {
  try {
    // Transaction оронд дараалсан query ашиглах
    // 1. Эхлээд policy-г soft delete
    const { data: policy, error: policyError } = await supabase
      .from("policy")
      .update({ is_deleted: true })
      .eq("id", id)
      .eq("is_deleted", false)
      .select()
      .single();

    if (policyError) throw policyError;

    // 2. Холбоотой section-уудыг soft delete
    const { error: sectionError } = await supabase
      .from("section")
      .update({ is_deleted: true })
      .eq("policy_id", id)
      .eq("is_deleted", false);

    if (sectionError) {
      console.error("Section soft delete error:", sectionError);
      // Үргэлжлүүлэх, учир нь гол policy устгагдсан
    }

    // 3. Холбоотой clause-уудыг soft delete
    const { error: clauseError } = await supabase
      .from("clause")
      .update({ is_deleted: true })
      .eq("policy_id", id)
      .eq("is_deleted", false);

    if (clauseError) {
      console.error("Clause soft delete error:", clauseError);
      // Үргэлжлүүлэх, учир нь гол policy устгагдсан
    }

    console.log("Policy deleted with cascade:", { policyId: id });
    return policy;
  } catch (error) {
    console.error("Error in deletePolicy:", error);
    throw new Error(`Журам устгахад алдаа гарлаа: ${(error as Error).message}`);
  }
};

export const restorePolicy = async (id: string) => {
  try {
    // 1. Эхлээд policy-г restore хийх
    const { data: policy, error: policyError } = await supabase
      .from("policy")
      .update({ is_deleted: false })
      .eq("id", id)
      .eq("is_deleted", true)
      .select()
      .single();

    if (policyError) throw policyError;

    // 2. Холбоотой section-уудыг restore хийх
    const { error: sectionError } = await supabase
      .from("section")
      .update({ is_deleted: false })
      .eq("policy_id", id)
      .eq("is_deleted", true);

    if (sectionError) {
      console.error("Section restore error:", sectionError);
    }

    // 3. Холбоотой clause-уудыг restore хийх
    const { error: clauseError } = await supabase
      .from("clause")
      .update({ is_deleted: false })
      .eq("policy_id", id)
      .eq("is_deleted", true);

    if (clauseError) {
      console.error("Clause restore error:", clauseError);
    }

    console.log("Policy restored with cascade:", { policyId: id });
    return policy;
  } catch (error) {
    throw new Error(
      `Журам сэргээхэд алдаа гарлаа: ${(error as Error).message}`
    );
  }
};

export async function createSection(sectionData: {
  policy_id: string;
  text: string;
  reference_number: string;
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("section")
    .insert([sectionData])
    .select()
    .single();

  if (error) {
    console.error("Create section error:", error);
    throw error;
  }

  return data;
}

export async function createClause(clauseData: {
  text: string;
  reference_number: string;
  section_id: string;
  parent_id?: string | null;
  policy_id: string;
}) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clause")
    .insert([clauseData])
    .select()
    .single();

  if (error) {
    console.error("Create clause error:", error);
    throw error;
  }

  return data;
}

const sortByReferenceNumberSection = (
  a: { reference_number: string | null },
  b: { reference_number: string | null }
) => {
  const refA = (a.reference_number ?? "").split(".").map(Number);
  const refB = (b.reference_number ?? "").split(".").map(Number);

  for (let i = 0; i < Math.max(refA.length, refB.length); i++) {
    const partA = refA[i] ?? 0;
    const partB = refB[i] ?? 0;

    if (partA !== partB) {
      return partA - partB;
    }
  }

  return 0;
};

const sortByReferenceNumber = (
  a: { reference_number: string | null },
  b: { reference_number: string | null },
) => {
  const refA = (a.reference_number ?? "").split(".").map(Number);
  const refB = (b.reference_number ?? "").split(".").map(Number);

  for (let i = 0; i < Math.max(refA.length, refB.length); i++) {
    const partA = refA[i] ?? 0;
    const partB = refB[i] ?? 0;

    if (partA !== partB) {
      return partA - partB;
    }
  }

  return 0;
};

const buildClauseTree = (
  clauses: ClauseRow[],
  parentId: string | null = null,
): ClauseEdit[] => {
  return clauses
    .filter((clause) => clause.parent_id === parentId && !clause.is_deleted)
    .sort(sortByReferenceNumber)
    .map((clause) => ({
      id: clause.id,
      text: clause.text,
      referenceNumber: clause.reference_number ?? "",
      sectionId: clause.section_id,
      parentId: clause.parent_id,
      policyId: clause.policy_id,
      isDeleted: clause.is_deleted,
      children: buildClauseTree(clauses, clause.id),
      clause_position: clause.clause_position || [],
    }));
};

export const getPolicy = async (id: string) => {
  try {
    // Policy-г авах
    const supabase = createClient();
    const { data: policy, error: policyError } = await supabase
      .from("policy")
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (policyError || !policy) {
      throw new Error("Журам олдсонгүй");
    }

    // Section-уудыг авах
    const { data: sections, error: sectionsError } = await supabase
      .from("section")
      .select("*")
      .eq("policy_id", policy.id)
      .eq("is_deleted", false);

    if (sectionsError) {
      throw new Error(`Section авахад алдаа гарлаа: ${sectionsError.message}`);
    }

    // Section-уудыг reference_number-р эрэмбэлэх
    const sortedSections = [...(sections || [])].sort(
      sortByReferenceNumberSection
    );

    // Section бүрийн clause-уудыг авах
    const sectionsWithClauses = await Promise.all(
      sortedSections.map(async (section) => {
        // Бүх clause-уудыг авах
        const { data: allClauses, error: clausesError } = await supabase
          .from("clause")
          .select("*")
          .eq("section_id", section.id)
          .eq("is_deleted", false);

        if (clausesError) {
          throw new Error(
            `Clause авахад алдаа гарлаа: ${clausesError.message}`
          );
        }

        // Clause position-уудыг авах
        const clauseIds = (allClauses || []).map((clause) => clause.id);
        let clausePositions: ClausePositionRow[] = [];

        if (clauseIds.length > 0) {
          const { data: positions, error: positionsError } = await supabase
            .from("clause_job_position")
            .select("*")
            .in("clause_id", clauseIds);

          if (!positionsError && positions) {
            clausePositions = positions;
          }
        }

        // Clause-ууд дээр position-уудыг нэмэх
        const clausesWithPositions = (allClauses || []).map((clause) => ({
          ...clause,
          clause_position: clausePositions.filter(
            (pos) => pos.clause_id === clause.id
          ),
        }));

        // Clause tree бүтээх
        const clauseTree = buildClauseTree(clausesWithPositions);

        return {
          id: section.id,
          policyId: section.policy_id,
          text: section.text,
          referenceNumber: section.reference_number,
          isDeleted: section.is_deleted,
          clause: clauseTree,
        };
      })
    );

    const { data: scopeTargets, error: scopeError } = await supabase
      .from("policy_scope_targets")
      .select("target_type, target_bteg_id, target_name, parent_bteg_id")
      .eq("policy_id", policy.id)
      .order("target_type")
      .order("target_name");

    if (scopeError) {
      throw new Error(`Хамаарах алба, хэлтэс авахад алдаа гарлаа: ${scopeError.message}`);
    }

    return {
      id: policy.id,
      name: policy.name,
      approvedDate: policy.approved_date,
      referenceCode: policy.reference_code,
      isDeleted: policy.is_deleted,
      scopeTargets: scopeTargets ?? [],
      section: sectionsWithClauses,
    };
  } catch (error) {
    throw new Error(`Журам хайхад алдаа гарлаа: ${(error as Error).message}`);
  }
};

export async function updatePolicy(
  policyId: string,
  policyData: Omit<Policy, "section">
) {
  const supabase = createClient();

  if (policyData.reference_code) {
    const { data: existingPolicy } = await supabase
      .from("policy")
      .select("id")
      .eq("reference_code", policyData.reference_code)
      .eq("is_deleted", false)
      .single();

    if (existingPolicy && existingPolicy.id !== policyId) {
      throw new Error("Журмын код бүртгэлтэй байна");
    }
  }

  let approvedDate = null;
  if (policyData.approved_date) {
    const date = new Date(policyData.approved_date);
    approvedDate = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  const { data, error } = await supabase
    .from("policy")
    .update({
      name: policyData.name,
      reference_code: policyData.reference_code,
      approved_date: approvedDate,
    })
    .eq("id", policyId)
    .select()
    .single();

  if (error) {
    console.error("Update policy error:", error);
    throw error;
  }

  await savePolicyScopeTargets(policyId, policyData.scope_targets);

  return data;
}
