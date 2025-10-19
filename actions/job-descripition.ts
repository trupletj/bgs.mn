import { JobDescription } from "@/types/types";
import { createClient } from "@/utils/supabase/client";
const supabase = createClient();

export const createJobDescription = async (data: JobDescription) => {
  try {
    // Job position байгаа эсэхийг шалгах
    // const { data: jobPosition, error: positionError } = await supabase
    //   .from("job_position")
    //   .select("id")
    //   .eq("id", data.job_position_id)
    //   .eq("is_active", true)
    //   .single();

    // if (positionError || !jobPosition) {
    //   throw new Error("Ажлын байр олдсонгүй");
    // }

    // Supervisor position байгаа эсэхийг шалгах
    // if (data.supervisor_pos_id) {
    //   const { data: supervisor, error: supervisorError } = await supabase
    //     .from("job_position")
    //     .select("id")
    //     .eq("id", data.supervisor_pos_id)
    //     .eq("is_active", true)
    //     .single();

    //   if (supervisorError) {
    //     throw new Error("Даргын ажлын байр олдсонгүй");
    //   }
    // }

    // Subordinate position байгаа эсэхийг шалгах
    // if (data.subordinate_pos_id) {
    //   const { data: subordinate, error: subordinateError } = await supabase
    //     .from("job_position")
    //     .select("id")
    //     .eq("id", data.subordinate_pos_id)
    //     .eq("is_active", true)
    //     .single();

    //   if (subordinateError) {
    //     throw new Error("Харьяалагдах ажлын байр олдсонгүй");
    //   }
    // }

    const { data: jobDescription, error } = await supabase
      .from("job_description")
      .insert({
        job_position_id: data.job_position_id,
        a_code: data.a_code,
        at_code: data.at_code,
        supervisor_pos_id: data.supervisor_pos_id || null,
        subordinate_pos_id: data.subordinate_pos_id || null,
        job_condition: data.job_condition,
        communication_scope: data.communication_scope,
        purpose: data.purpose,
        schedule: data.schedule,
        daily_hours: data.daily_hours,
        break_time: data.break_time,
        duties: data.duties,
        education_level: data.education_level,
        work_experience: data.work_experience,
        general_skills: data.general_skills,
        professional_skills: data.professional_skills,
        additional_courses: data.additional_courses,
        resources: data.resources,
        authority: data.authority,
        responsibilities: data.responsibilities,
        property_liability: data.property_liability,
        relevant_laws: data.relevant_laws,
        note: data.note,
      })
      .select()
      .single();

    if (error) throw error;
    return jobDescription;
  } catch (error) {
    throw new Error(
      `Ажлын байрны тодорхойлолт үүсгэхэд алдаа гарлаа: ${
        (error as Error).message
      }`
    );
  }
};

export const updateJobDescription = async (
  id: string,
  data: Partial<JobDescription>
) => {
  try {
    // Job position байгаа эсэхийг шалгах
    // if (data.job_position_id) {
    //   const { data: jobPosition, error: positionError } = await supabase
    //     .from("job_position")
    //     .select("id")
    //     .eq("id", data.job_position_id)
    //     .eq("is_active", true)
    //     .single();

    //   if (positionError || !jobPosition) {
    //     throw new Error("Ажлын байр олдсонгүй");
    //   }
    // }

    // Supervisor position байгаа эсэхийг шалгах
    // if (data.supervisor_pos_id) {
    //   const { data: supervisor, error: supervisorError } = await supabase
    //     .from("job_position")
    //     .select("id")
    //     .eq("id", data.supervisor_pos_id)
    //     .eq("is_active", true)
    //     .single();

    //   if (supervisorError) {
    //     throw new Error("Даргын ажлын байр олдсонгүй");
    //   }
    // }

    // Subordinate position байгаа эсэхийг шалгах
    // if (data.subordinate_pos_id) {
    //   const { data: subordinate, error: subordinateError } = await supabase
    //     .from("job_position")
    //     .select("id")
    //     .eq("id", data.subordinate_pos_id)
    //     .eq("is_active", true)
    //     .single();

    //   if (subordinateError) {
    //     throw new Error("Харьяалагдах ажлын байр олдсонгүй");
    //   }
    // }

    const { data: jobDescription, error } = await supabase
      .from("job_description")
      .update({
        ...data,
        supervisor_pos_id: data.supervisor_pos_id || null,
        subordinate_pos_id: data.subordinate_pos_id || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return jobDescription;
  } catch (error) {
    throw new Error(
      `Ажлын байрны тодорхойлолт засахад алдаа гарлаа: ${
        (error as Error).message
      }`
    );
  }
};

export const getJobDescription = async (id: string) => {
  try {
    const { data: jobDescription, error } = await supabase
      .from("job_description")
      .select(
        `
        *,
        job_position:job_position_id (*),
        supervisor:supervisor_pos_id (*),
        subordinate:subordinate_pos_id (*)
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    return jobDescription;
  } catch (error) {
    throw new Error(
      `Ажлын байрны тодорхойлолт хайхад алдаа гарлаа: ${
        (error as Error).message
      }`
    );
  }
};

export const getAllJobDescriptions = async () => {
  try {
    const { data: jobDescriptions, error } = await supabase
      .from("job_description")
      .select(
        `
        *,
        job_position:job_position_id (*),
        supervisor:supervisor_pos_id (*),
        subordinate:subordinate_pos_id (*)
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return jobDescriptions || [];
  } catch (error) {
    throw new Error(
      `Ажлын байрны тодорхойлолтууд хайхад алдаа гарлаа: ${
        (error as Error).message
      }`
    );
  }
};

export const deleteJobDescription = async (id: string) => {
  try {
    const { error } = await supabase
      .from("job_description")
      .update({ is_deleted: true })
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (error) {
    throw new Error(
      `Ажлын байрны тодорхойлолт устгахад алдаа гарлаа: ${
        (error as Error).message
      }`
    );
  }
};
