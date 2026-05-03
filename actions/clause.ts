import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type ReferenceNumberRow = {
  reference_number: string | null;
};

type ClausePositionInput = {
  positionId?: string | null;
  job_position_id?: string | null;
  type?: string | null;
};

type ClauseUpdateData = Partial<{
  text: string;
  reference_number: string;
  section_id: string;
  parent_id: string | null;
  policy_id: string;
}>;

export const getClauses = async ({ section_id }: { section_id: string }) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clause")
    .select("*")
    .eq("section_id", section_id)
    .eq("is_deleted", false);

  if (error) throw new Error("Заалтууд олдсонгүй");

  return sortByReferenceNumber(data);
};

const sortByReferenceNumber = <T extends ReferenceNumberRow>(clauses: T[]) => {
  return clauses.sort((a, b) => {
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
  });
};

export async function getClauseById(clauseId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clause")
    .select("text, reference_number")
    .eq("id", clauseId)
    .single();

  if (error) {
    console.error("Get clause error:", error);
    return null;
  }

  return data;
}

export const createClause = async (data: {
  text: string;
  reference_number: string;
  section_id: string;
  parent_id?: string | null;
  policy_id: string;
  positions?: ClausePositionInput[];
}) => {
  try {
    // Section байгаа эсэхийг шалгах
    if (data.section_id) {
      const { data: section, error: sectionError } = await supabase
        .from("section")
        .select("id")
        .eq("id", data.section_id)
        .eq("is_deleted", false)
        .single();

      if (sectionError || !section) {
        throw new Error("Холбогдох бүлэг олдсонгүй");
      }
    }

    // Parent clause байгаа эсэхийг шалгах
    if (data.parent_id) {
      const { data: parent, error: parentError } = await supabase
        .from("clause")
        .select("id")
        .eq("id", data.parent_id)
        .eq("is_deleted", false)
        .single();

      if (parentError || !parent) {
        throw new Error("Холбогдох эцэг заалт олдсонгүй");
      }
    }

    // Policy байгаа эсэхийг шалгах
    const { data: policy, error: policyError } = await supabase
      .from("policy")
      .select("id")
      .eq("id", data.policy_id)
      .eq("is_deleted", false)
      .single();

    if (policyError || !policy) {
      throw new Error("Холбогдох журам олдсонгүй");
    }

    // Clause үүсгэх
    const { data: clause, error } = await supabase
      .from("clause")
      .insert({
        text: data.text,
        reference_number: data.reference_number,
        section_id: data.section_id,
        parent_id: data.parent_id,
        policy_id: data.policy_id,
        is_deleted: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Position-уудыг хадгалах
    if (data.positions && data.positions.length > 0) {
      const clausePositions = data.positions.map((position) => ({
        clause_id: clause.id,
        position_id: position.positionId ?? position.job_position_id,
        type: position.type,
      })).filter((position) => position.position_id && position.type);

      const { error: positionError } = await supabase
        .from("clause_job_position")
        .insert(clausePositions);

      if (positionError) {
        console.error("Position хадгалахад алдаа:", positionError);
      }
    }

    return {
      ...clause,
      // Хуучин field name-үүдэд тохируулах
      referenceNumber: clause.reference_number,
      sectionId: clause.section_id,
      parentId: clause.parent_id,
      policyId: clause.policy_id,
      isDeleted: clause.is_deleted,
      clause_position: data.positions || [],
    };
  } catch (error) {
    throw new Error(`Заалт нэмэхэд алдаа гарлаа: ${(error as Error).message}`);
  }
};

export const getClause = async (id: string) => {
  try {
    const { data: clause, error } = await supabase
      .from("clause")
      .select(
        `
        *,
        section:section_id (*),
        policy:policy_id (*),
        clause_job_position (*)
      `
      )
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (error || !clause) {
      throw new Error("Заалт олдсонгүй");
    }

    return {
      ...clause,
      // Хуучин field name-үүдэд тохируулах
      referenceNumber: clause.reference_number,
      sectionId: clause.section_id,
      parentId: clause.parent_id,
      policyId: clause.policy_id,
      isDeleted: clause.is_deleted,
      clause_job_position: clause.clause_job_position || [],
    };
  } catch (error) {
    throw new Error(`Заалт хайхад алдаа гарлаа: ${(error as Error).message}`);
  }
};

export const getAllClauses = async (sectionId?: string) => {
  try {
    let query = supabase
      .from("clause")
      .select(
        `
        *,
        policy:policy_id (*),
        clause_job_position (*)
      `
      )
      .eq("is_deleted", false);

    if (sectionId) {
      query = query.eq("section_id", sectionId);
    }

    const { data: clauses, error } = await query;

    if (error) throw error;

    // Field name conversion
    return (clauses || []).map((clause) => ({
      ...clause,
      referenceNumber: clause.reference_number,
      sectionId: clause.section_id,
      parentId: clause.parent_id,
      policyId: clause.policy_id,
      isDeleted: clause.is_deleted,
      clause_job_position: clause.clause_job_position || [],
    }));
  } catch (error) {
    throw new Error(
      `Заалтууд хайхад алдаа гарлаа: ${(error as Error).message}`
    );
  }
};

export const updateClause = async (
  id: string,
  data: Partial<{
    text: string;
    reference_number: string;
    section_id: string;
    parent_id: string | null;
    policy_id: string;
    positions?: ClausePositionInput[];
  }>
) => {
  try {
    // Section байгаа эсэхийг шалгах
    if (data.section_id) {
      const { data: section, error: sectionError } = await supabase
        .from("section")
        .select("id")
        .eq("id", data.section_id)
        .eq("is_deleted", false)
        .single();

      if (sectionError || !section) {
        throw new Error("Холбогдох бүлэг олдсонгүй");
      }
    }

    // Parent clause байгаа эсэхийг шалгах
    if (data.parent_id) {
      const { data: parent, error: parentError } = await supabase
        .from("clause")
        .select("id")
        .eq("id", data.parent_id)
        .eq("is_deleted", false)
        .single();

      if (parentError || !parent) {
        throw new Error("Холбогдох эцэг заалт олдсонгүй");
      }
    }

    // Policy байгаа эсэхийг шалгах
    if (data.policy_id) {
      const { data: policy, error: policyError } = await supabase
        .from("policy")
        .select("id")
        .eq("id", data.policy_id)
        .eq("is_deleted", false)
        .single();

      if (policyError || !policy) {
        throw new Error("Холбогдох журам олдсонгүй");
      }
    }

    // Clause update хийх
    const updateData: ClauseUpdateData = {};
    if (data.text !== undefined) updateData.text = data.text;
    if (data.reference_number !== undefined)
      updateData.reference_number = data.reference_number;
    if (data.section_id !== undefined) updateData.section_id = data.section_id;
    if (data.parent_id !== undefined) updateData.parent_id = data.parent_id;
    if (data.policy_id !== undefined) updateData.policy_id = data.policy_id;

    const { data: clause, error } = await supabase
      .from("clause")
      .update(updateData)
      .eq("id", id)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) throw error;

    // Position-уудыг update хийх
    if (data.positions !== undefined) {
      // Хуучин position-уудыг устгах
      const { error: deleteError } = await supabase
        .from("clause_job_position")
        .delete()
        .eq("clause_id", id);

      if (deleteError) {
        console.error("Хуучин position устгахад алдаа:", deleteError);
      }

      // Шинэ position-уудыг нэмэх
      if (data.positions && data.positions.length > 0) {
        const clausePositions = data.positions.map((position) => ({
          clause_id: id,
          position_id: position.positionId ?? position.job_position_id,
          type: position.type,
        })).filter((position) => position.position_id && position.type);

        const { error: positionError } = await supabase
          .from("clause_job_position")
          .insert(clausePositions);

        if (positionError) {
          console.error("Шинэ position хадгалахад алдаа:", positionError);
        }
      }
    }

    return {
      ...clause,
      // Хуучин field name-үүдэд тохируулах
      referenceNumber: clause.reference_number,
      sectionId: clause.section_id,
      parentId: clause.parent_id,
      policyId: clause.policy_id,
      isDeleted: clause.is_deleted,
      clause_position: data.positions || [],
    };
  } catch (error) {
    throw new Error(`Заалт засахад алдаа гарлаа: ${(error as Error).message}`);
  }
};

export const deleteClause = async (id: string) => {
  try {
    const { data: clause, error } = await supabase
      .from("clause")
      .update({ is_deleted: true })
      .eq("id", id)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) throw error;

    return {
      ...clause,
      // Хуучин field name-үүдэд тохируулах
      referenceNumber: clause.reference_number,
      sectionId: clause.section_id,
      parentId: clause.parent_id,
      policyId: clause.policy_id,
      isDeleted: clause.is_deleted,
    };
  } catch (error) {
    throw new Error(`Заалт устгахад алдаа гарлаа: ${(error as Error).message}`);
  }
};

export const restoreClause = async (id: string) => {
  try {
    const { data: clause, error: fetchError } = await supabase
      .from("clause")
      .select("is_deleted")
      .eq("id", id)
      .single();

    if (fetchError || !clause) {
      throw new Error("Заалт олдсонгүй");
    }

    if (!clause.is_deleted) {
      throw new Error("Заалт аль хэдийн идэвхтэй байна");
    }

    const { data: restoredClause, error } = await supabase
      .from("clause")
      .update({ is_deleted: false })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return {
      ...restoredClause,
      // Хуучин field name-үүдэд тохируулах
      referenceNumber: restoredClause.reference_number,
      sectionId: restoredClause.section_id,
      parentId: restoredClause.parent_id,
      policyId: restoredClause.policy_id,
      isDeleted: restoredClause.is_deleted,
    };
  } catch (error) {
    throw new Error(
      `Заалтыг сэргээхэд алдаа гарлаа: ${(error as Error).message}`
    );
  }
};

export const getAllSortedClauses = async (sectionId?: string) => {
  try {
    let query = supabase.from("clause").select("*").eq("is_deleted", false);

    if (sectionId) {
      query = query.eq("section_id", sectionId);
    }

    const { data: clauses, error } = await query;

    if (error) throw error;

    const sortedClauses = sortByReferenceNumber(clauses || []);

    // Field name conversion
    return sortedClauses.map((clause) => ({
      ...clause,
      referenceNumber: clause.reference_number,
      sectionId: clause.section_id,
      parentId: clause.parent_id,
      policyId: clause.policy_id,
      isDeleted: clause.is_deleted,
    }));
  } catch (error) {
    throw new Error(
      `Заалтууд хайхад алдаа гарлаа: ${(error as Error).message}`
    );
  }
};
