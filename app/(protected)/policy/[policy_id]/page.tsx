import Link from "next/link";
import { ArrowLeft, FileText, Gavel, Pencil } from "lucide-react";
import { hasPermission, hasRole } from "@/actions/rbac";
import { getPolicyDetail } from "@/actions/policy-detail";
import {
  formatLegalActDate,
  getPolicyRevisionMarkers,
  type RevisionMarker,
} from "@/actions/policy-legal-acts";
import { getRevisionChangeActionLabel } from "@/lib/policy-revision-actions";
import { PolicyDetailContent } from "@/components/policy/policy-detail-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPolicyDate } from "@/lib/policy-utils";

interface PolicyDetailPageProps {
  params: Promise<{ policy_id: string }>;
}

export const revalidate = 0;

function getLegalActRevisionGroups(markers: RevisionMarker[]) {
  const groups = new Map<
    string,
    {
      legalAct: RevisionMarker["legal_act"];
      actions: Set<RevisionMarker["change_action"]>;
      targetTypes: Set<RevisionMarker["target_type"]>;
      count: number;
    }
  >();

  markers.forEach((marker) => {
    const existing = groups.get(marker.legal_act.id);
    if (existing) {
      existing.actions.add(marker.change_action);
      existing.targetTypes.add(marker.target_type);
      existing.count += 1;
      return;
    }

    groups.set(marker.legal_act.id, {
      legalAct: marker.legal_act,
      actions: new Set([marker.change_action]),
      targetTypes: new Set([marker.target_type]),
      count: 1,
    });
  });

  return Array.from(groups.values()).sort(
    (a, b) =>
      new Date(b.legalAct.act_date).getTime() -
      new Date(a.legalAct.act_date).getTime(),
  );
}

function getRevisionTargetTypeLabel(type: RevisionMarker["target_type"]) {
  if (type === "policy") return "Журам";
  if (type === "section") return "Бүлэг";
  return "Заалт";
}

export default async function PolicyDetailPage({
  params,
}: PolicyDetailPageProps) {
  const { policy_id } = await params;

  const [policy, isEditAccess, isRating, revisionMarkers] = await Promise.all([
    getPolicyDetail(policy_id),
    hasPermission("policy", "edit"),
    hasRole(["super_admin", "monitoring_emp"]),
    getPolicyRevisionMarkers(policy_id),
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

  const revisionGroups = getLegalActRevisionGroups(revisionMarkers);

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

      {revisionMarkers.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Gavel className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Эрх зүйн акт / шинэчлэлийн түүх
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {revisionGroups.map((group) => (
              <Button
                key={group.legalAct.id}
                asChild
                variant="outline"
                size="sm"
                className="h-auto justify-start whitespace-normal py-2"
              >
                <Link href={`/policy/legal-acts/${group.legalAct.id}`}>
                  <Badge variant="secondary" className="mr-1">
                    {group.legalAct.act_type}
                  </Badge>
                  <span className="min-w-0 text-left">
                    {group.legalAct.act_number} ·{" "}
                    {formatLegalActDate(group.legalAct.act_date)} ·{" "}
                    {Array.from(group.actions)
                      .map((action) => getRevisionChangeActionLabel(action))
                      .join(", ")}{" "}
                    ·{" "}
                    {Array.from(group.targetTypes)
                      .map((type) => getRevisionTargetTypeLabel(type))
                      .join(", ")}{" "}
                    · {group.count} хэсэг
                  </span>
                </Link>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Sections + Clauses */}
      <PolicyDetailContent
        policy={policy}
        isRating={isRating}
        revisionMarkers={revisionMarkers}
      />
    </div>
  );
}
