import { JobDescriptionDetail } from "@/components/job-description/job-description-detail";
import { createClient } from "@/utils/supabase/client";

interface JobDescriptionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: JobDescriptionDetailPageProps) {
  const { id } = await params;
  const supabase = createClient();

  // Job description-ийг job_position-той хамт авах
  const { data, error } = await supabase
    .from("job_description")
    .select(
      `
      *,
      job_position:job_position_id (
        id,
        name,
        organization_id,
        alba_id,
        heltes_id
      ),
      supervisor:supervisor_pos_id (
        id,
        name,
        organization_id,
        alba_id,
        heltes_id
      ),
      subordinate:subordinate_pos_id (
        id,
        name,
        organization_id,
        alba_id,
        heltes_id
      )
    `
    )
    .eq("id", id)
    .eq("is_deleted", false)
    .single();

  if (error) throw new Error("Ажлын байрны тодорхойлолт олдсонгүй");

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <JobDescriptionDetail data={data} />
    </div>
  );
}
