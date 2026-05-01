import Link from "next/link";
import { ArrowLeft, FileText, Pencil } from "lucide-react";
import { hasPermission, hasRole } from "@/actions/rbac";
import { getPolicyDetail } from "@/actions/policy-detail";
import { PolicyDetailContent } from "@/components/policy/policy-detail-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPolicyDate } from "@/lib/policy-utils";

interface PolicyDetailPageProps {
  params: Promise<{ policy_id: string }>;
}

export const revalidate = 0;

export default async function PolicyDetailPage({
  params,
}: PolicyDetailPageProps) {
  const { policy_id } = await params;

  const [policy, isEditAccess, isRating] = await Promise.all([
    getPolicyDetail(policy_id),
    hasPermission("policy", "edit"),
    hasRole(["super_admin", "monitoring_emp"]),
  ]);

  if (!policy) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href="/policy">
            <ArrowLeft className="h-4 w-4" />
            Буцах
          </Link>
        </Button>
        <Card className="items-center gap-2 px-4 py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">Журам олдсонгүй</p>
          <p className="text-sm text-muted-foreground">
            Та буруу холбоосоор орсон эсвэл журам устсан байж магадгүй
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon-sm">
            <Link href="/policy">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Буцах</span>
            </Link>
          </Button>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Журам / Дэлгэрэнгүй
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {policy.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {policy.reference_code && (
                <Badge variant="outline" className="font-mono text-xs">
                  {policy.reference_code}
                </Badge>
              )}
              <span className="text-muted-foreground">
                Баталсан:{" "}
                <span className="text-foreground tabular-nums">
                  {formatPolicyDate(policy.approved_date)}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {policy.sections.length} бүлэг
              </span>
            </div>
          </div>

          {isEditAccess && (
            <Button asChild>
              <Link href={`/policy/${policy.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Засварлах
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Sections + Clauses */}
      <PolicyDetailContent policy={policy} isRating={isRating} />
    </div>
  );
}
