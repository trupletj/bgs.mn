import { hasPermission, hasRole } from "@/actions/rbac";
import { JobDescriptionForm } from "@/components/job-description/job-description-form";
import { createClient } from "@/utils/supabase/client";
import { notFound, redirect } from "next/navigation";

interface EditJobDescriptionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditJobDescriptionPage({
  params,
}: EditJobDescriptionPageProps) {
  const has_permission = await hasPermission("job_description", "edit");

  if (!has_permission) {
    redirect("/unauthorized");
  }

  const is_delete = await hasPermission("job_description", "delete");

  const { id } = await params;
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("job_description")
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .single();

    if (error || !data) {
      console.error("Error fetching job description:", error);
      notFound();
    }

    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Албан тушаалын тодорхойлолт засварлах
              </h1>
              <p className="text-muted-foreground">
                Албан тушаалын дэлгэрэнгүй мэдээллийг засварлана уу.
              </p>
            </div>
            <JobDescriptionForm
              initialData={data}
              isEdit={true}
              isDelete={is_delete}
            />
          </div>
        </div>
      </main>
    );
  } catch (error) {
    console.error("Error in edit page:", error);
    notFound();
  }
}
