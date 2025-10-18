import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export const getSections = async ({ policy_id }: { policy_id: string }) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("section")
    .select("*")
    .eq("policy_id", policy_id)
    .eq("is_deleted", false);

  if (error) throw new Error("Бүлгүүд олдсонгүй");

  return sortByReferenceNumber(data);
};

const sortByReferenceNumber = (sections: any[]) => {
  return sections.sort((a, b) => {
    const refA = a.reference_number.split(".").map(Number);
    const refB = b.reference_number.split(".").map(Number);

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

export const createSection = async (data: {
  policy_id: string;
  reference_number: string;
  text: string;
}) => {
  try {
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

    const { data: section, error } = await supabase
      .from("section")
      .insert({
        policy_id: data.policy_id,
        reference_number: data.reference_number,
        text: data.text,
        is_deleted: false,
      })
      .select()
      .single();

    if (error) throw error;
    return section;
  } catch (error) {
    throw new Error(`Бүлэг нэмэхэд алдаа гарлаа: ${(error as Error).message}`);
  }
};

export const getSection = async (id: string) => {
  try {
    const { data: section, error } = await supabase
      .from("section")
      .select(
        `
        *,
        clause (*),
        policy (*)
      `
      )
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (error || !section) {
      throw new Error("Бүлэг олдсонгүй");
    }

    return {
      ...section,
      // Хуучин field name-үүдэд тохируулах
      policyId: section.policy_id,
      referenceNumber: section.reference_number,
      isDeleted: section.is_deleted,
    };
  } catch (error) {
    throw new Error(`Бүлэг хайхад алдаа гарлаа: ${(error as Error).message}`);
  }
};

export const getAllSections = async (policyId?: string) => {
  try {
    let query = supabase
      .from("section")
      .select(
        `
        *,
        clause (*)
      `
      )
      .eq("is_deleted", false);

    if (policyId) {
      query = query.eq("policy_id", policyId);
    }

    const { data: sections, error } = await query;

    if (error) throw error;

    const sortedSections = sortByReferenceNumber(sections || []);

    // Field name conversion
    return sortedSections.map((section) => ({
      ...section,
      policyId: section.policy_id,
      referenceNumber: section.reference_number,
      isDeleted: section.is_deleted,
    }));
  } catch (error) {
    throw new Error(`Бүлгүүд хайхад алдаа гарлаа: ${(error as Error).message}`);
  }
};

export const updateSectionField = async (
  id: string,
  field: "reference_number" | "text",
  value: string
) => {
  try {
    const { error } = await supabase
      .from("section")
      .update({ [field]: value })
      .eq("id", id)
      .eq("is_deleted", false);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message || "Алдаа гарлаа" };
  }
};

export const updateSection = async (
  id: string,
  data: Partial<{
    policy_id: string;
    reference_number: string;
    text: string;
  }>
) => {
  try {
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

    const { data: section, error } = await supabase
      .from("section")
      .update({
        policy_id: data.policy_id,
        reference_number: data.reference_number,
        text: data.text,
      })
      .eq("id", id)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) throw error;
    return section;
  } catch (error) {
    throw new Error(`Бүлэг засахад алдаа гарлаа: ${(error as Error).message}`);
  }
};

export const deleteSection = async (id: string) => {
  try {
    const { data: section, error } = await supabase
      .from("section")
      .update({ is_deleted: true })
      .eq("id", id)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) throw error;
    return section;
  } catch (error) {
    throw new Error(`Бүлэг устгахад алдаа гарлаа: ${(error as Error).message}`);
  }
};

export const restoreSection = async (id: string) => {
  try {
    const { data: section, error } = await supabase
      .from("section")
      .update({ is_deleted: false })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return section;
  } catch (error) {
    throw new Error(
      `Бүлэг сэргээхэд алдаа гарлаа: ${(error as Error).message}`
    );
  }
};
