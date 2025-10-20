import { JobDescriptionDetail } from "@/components/job-description/job-description-detail";
import { createClient } from "@/utils/supabase/client";

interface JobDescriptionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: JobDescriptionDetailPageProps) {
  const { id } = await params;
  const supabase = createClient();

  // Job description-ийг авах
  const { data: jobDescription, error } = await supabase
    .from("job_description")
    .select("*")
    .eq("id", id)
    .eq("is_deleted", false)
    .single();

  if (error || !jobDescription) {
    throw new Error("Ажлын байрны тодорхойлолт олдсонгүй");
  }

  // Supervisor болон subordinate ID-уудыг задлах
  const supervisorIds = jobDescription.supervisor_pos_id
    ? Array.isArray(jobDescription.supervisor_pos_id)
      ? jobDescription.supervisor_pos_id
      : jobDescription.supervisor_pos_id.split(",").filter(Boolean)
    : [];

  const subordinateIds = jobDescription.subordinate_pos_id
    ? Array.isArray(jobDescription.subordinate_pos_id)
      ? jobDescription.subordinate_pos_id
      : jobDescription.subordinate_pos_id.split(",").filter(Boolean)
    : [];

  // Job position-уудыг авах
  const { data: jobPosition } = await supabase
    .from("job_position")
    .select("id, name, organization_id, alba_id, heltes_id")
    .eq("id", jobDescription.job_position_id)
    .single();

  // Supervisor position-уудыг авах
  const { data: supervisors } =
    supervisorIds.length > 0
      ? await supabase
          .from("job_position")
          .select("id, name, organization_id, alba_id, heltes_id")
          .in("id", supervisorIds)
      : { data: [] };

  // Subordinate position-уудыг авах
  const { data: subordinates } =
    subordinateIds.length > 0
      ? await supabase
          .from("job_position")
          .select("id, name, organization_id, alba_id, heltes_id")
          .in("id", subordinateIds)
      : { data: [] };

  const data = {
    ...jobDescription,
    job_position: jobPosition || null,
    supervisors: supervisors || [],
    subordinates: subordinates || [],
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <JobDescriptionDetail data={data} />
    </div>
  );
}
