import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasPermission } from "@/actions/rbac";
import {
  getLegalActDetail,
  getPolicyPickerData,
} from "@/actions/policy-legal-acts";
import UnauthorizedPage from "@/app/unauthorized/page";
import {
  LegalActForm,
  type LegalActFormInitialData,
} from "@/components/policy/legal-acts/legal-act-form";
import { Button } from "@/components/ui/button";

interface EditLegalActPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 0;

export default async function EditLegalActPage({
  params,
}: EditLegalActPageProps) {
  const { id } = await params;
  const canEdit = await hasPermission("policy", "edit");
  if (!canEdit) return <UnauthorizedPage />;

  const [act, policies] = await Promise.all([
    getLegalActDetail(id),
    getPolicyPickerData(),
  ]);

  if (!act) notFound();

  const revision = act.revisions[0] ?? null;
  const initialData: LegalActFormInitialData = {
    id: act.id,
    act_type: act.act_type,
    act_number: act.act_number,
    act_date: act.act_date,
    title: act.title,
    body_text: act.body_text,
    notes: act.notes,
    policy_id: revision?.policy_id ?? null,
    summary: revision?.summary ?? null,
    revision_targets: revision?.targets.map((target) => ({
      targetType: target.target_type,
      changeAction: target.change_action,
      policyId: target.policy_id ?? revision.policy_id,
      sectionId: target.section_id,
      clauseId: target.clause_id,
      changeNote: target.change_note,
    })),
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon-sm">
          <Link href={`/policy/legal-acts/${act.id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Буцах</span>
          </Link>
        </Button>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Журам / Эрх зүйн акт
        </p>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Эрх зүйн акт засварлах
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Бүртгэлийн талбарууд болон журмын шинэчлэлийн холбоосыг шинэчилнэ
        </p>
      </div>

      <LegalActForm policies={policies} initialData={initialData} mode="edit" />
    </div>
  );
}
