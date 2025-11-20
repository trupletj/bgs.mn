import { Button } from "@/components/ui/button";
import Link from "next/link";
// import { policy } from "@repo/database/generated/prisma/client/client";
import { createClient } from "@/utils/supabase/client";
import SectionList from "@/components/policy/SectionList";
import { hasPermission } from "@/actions/rbac";
// import { hasAccess } from "@/action/PermissionService";

interface PolicyDetailPageProps {
  params: Promise<{ policy_id: string }>;
}

export default async function PolicyDetailPage({
  params,
}: PolicyDetailPageProps) {
  const { policy_id } = await params;
  const isEditAccess = await hasPermission("policy", "edit");
  //   const isEditAccess = await hasAccess("/dashboard/policy/edit", "UPDATE");
  const supabase = createClient();
  const { data: policy, error } = await supabase
    .from("policy")
    .select("*")
    .eq("id", policy_id)
    .eq("is_deleted", false)
    .single();

  if (error) throw new Error("Журам олдсонгүй");

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">{policy?.name}</h1>
        <div className="flex-shrink-0 ml-4">
          <Link href="/policy">
            <Button variant="outline" className="mr-2">
              Буцах
            </Button>
          </Link>
          {isEditAccess && (
            <Link href={`/policy/${policy_id}/edit`}>
              <Button variant="secondary" className="ml-2">
                Засварлах
              </Button>
            </Link>
          )}
        </div>
      </div>

      <p className="font-semibold">Код: {policy?.referenceCode}</p>
      <p className="font-semibold mb-4">
        Баталсан огноо:{" "}
        {policy?.approved_date
          ? new Date(policy.approved_date).toLocaleDateString("mn-MN")
          : "Огноогүй"}
      </p>
      <SectionList policy_id={policy_id} />
    </div>
  );
}
