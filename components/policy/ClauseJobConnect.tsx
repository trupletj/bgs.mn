import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOrganizations } from "@/actions/organization";
import { getPolicyById } from "@/actions/policy";
import { getClauseById } from "@/actions/clause";
import { getClauseJobPositionsForClause } from "@/actions/clause-position";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ClauseConnectClient,
  type PositionInfo,
} from "./ClauseConnectClient";
import type { OrganizationWithJobRelations } from "@/types/types";

interface ClauseJobConnectProps {
  policy_id: string;
  clause_id: string;
}

function buildPositionInfoMap(
  organizations: OrganizationWithJobRelations[],
): Record<string, PositionInfo> {
  const out: Record<string, PositionInfo> = {};
  for (const org of organizations) {
    for (const pos of org.job_position ?? []) {
      out[pos.id] = { id: pos.id, name: pos.name, scope: org.name };
    }
    for (const helts of org.heltes ?? []) {
      const heltesScope = `${org.name} / ${helts.name}`;
      for (const pos of helts.job_position ?? []) {
        out[pos.id] = { id: pos.id, name: pos.name, scope: heltesScope };
      }
      for (const alba of helts.alba ?? []) {
        const albaScope = `${org.name} / ${helts.name} / ${alba.name}`;
        for (const pos of alba.job_position ?? []) {
          out[pos.id] = { id: pos.id, name: pos.name, scope: albaScope };
        }
      }
    }
  }
  return out;
}

export default async function ClauseJobConnect({
  policy_id,
  clause_id,
}: ClauseJobConnectProps) {
  const [organizations, policy, clause, existingPositions] = await Promise.all([
    getOrganizations(),
    getPolicyById(policy_id),
    getClauseById(clause_id),
    getClauseJobPositionsForClause(clause_id),
  ]);

  const positionInfoById = buildPositionInfoMap(organizations || []);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Top breadcrumb */}
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon-sm">
          <Link href={`/policy/${policy_id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Журам руу буцах</span>
          </Link>
        </Button>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Журам / Ажлын байр холбох
        </p>
      </div>

      {/* Policy block */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {policy?.name || "Журам"}
        </h1>
        {policy?.reference_code && (
          <p className="font-mono text-xs text-muted-foreground">
            {policy.reference_code}
          </p>
        )}
      </div>

      {/* Clause block */}
      <Card className="px-4 py-3">
        <div className="flex items-baseline gap-3">
          <Badge variant="outline" className="font-mono text-xs">
            {clause?.reference_number || "—"}
          </Badge>
          <p className="flex-1 text-sm font-medium leading-relaxed text-foreground">
            {clause?.text || "Заалт"}
          </p>
        </div>
      </Card>

      {/* Linked positions + org tree (Client) */}
      <ClauseConnectClient
        organizations={organizations || []}
        initialPositions={existingPositions}
        positionInfoById={positionInfoById}
      />
    </div>
  );
}
