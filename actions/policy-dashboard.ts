"use server";

import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import type {
  JobPositionPerfItem,
  JobPositionPerfSummary,
  PolicyClauseStat,
  PolicyDashboardItem,
  PolicyDashboardSummary,
  PolicyJobPositionStat,
  PositionClauseStat,
  PositionPolicyGroup,
} from "@/lib/policy-utils";

const fetchDashboard = cache(async () => {
  const supabase = await createClient();

  const [{ data: policies, error: policyErr }, { data: cjps, error: cjpErr }] =
    await Promise.all([
      supabase
        .from("policy")
        .select("id, name, reference_code, approved_date")
        .eq("is_deleted", false)
        .order("approved_date", { ascending: false }),
      supabase
        .from("clause_job_position")
        .select(
          `
          id,
          is_checked,
          type,
          clause:clause!clause_id (
            id,
            text,
            reference_number,
            policy_id
          ),
          job_position:job_position!job_position_id (
            id,
            name,
            heltes:heltes!heltes_id (name, sub_title),
            alba:alba!alba_id (name, sub_title),
            organization:organization!organization_id (name, sub_title)
          ),
          ratings:rating!clause_job_position_id (
            score,
            scored_date,
            description
          )
        `,
        )
        .eq("is_checked", true),
    ]);

  if (policyErr) console.error("[policy-dashboard] policy:", policyErr.message);
  if (cjpErr) console.error("[policy-dashboard] cjp:", cjpErr.message);

  const policyMap = new Map<
    string,
    {
      id: string;
      name: string;
      reference_code: string | null;
      approved_date: string | null;
      totalScore: number;
      validCount: number;
      checkedCount: number;
      departments: Set<string>;
      clauses: Map<string | number, PolicyClauseStat>;
      hasRatings: boolean;
    }
  >();

  const policyMeta = new Map<
    string,
    { name: string; reference_code: string | null }
  >();

  const positionMap = new Map<
    string,
    {
      id: string;
      name: string;
      organizationName: string;
      heltesName: string;
      albaName: string;
      totalScore: number;
      validCount: number;
      linkedCount: number;
      hasRatings: boolean;
      policies: Map<string, Map<string | number, PositionClauseStat>>;
    }
  >();

  (policies ?? []).forEach((p) => {
    policyMap.set(p.id, {
      id: p.id,
      name: p.name || "Нэргүй",
      reference_code: p.reference_code,
      approved_date: p.approved_date,
      totalScore: 0,
      validCount: 0,
      checkedCount: 0,
      departments: new Set<string>(),
      clauses: new Map(),
      hasRatings: false,
    });
    policyMeta.set(p.id, {
      name: p.name || "Нэргүй",
      reference_code: p.reference_code,
    });
  });

  (cjps ?? []).forEach((cjp: Record<string, unknown>) => {
    const clause = cjp.clause as
      | {
          id: string | number;
          text: string;
          reference_number: string;
          policy_id: string;
        }
      | null;
    const policyId = clause?.policy_id;
    if (!policyId || !policyMap.has(policyId)) return;

    const stats = policyMap.get(policyId)!;
    stats.checkedCount++;

    const jobPosition = cjp.job_position as
      | {
          id: string | number;
          name: string | null;
          heltes?: { name?: string | null; sub_title?: string | null } | null;
          alba?: { name?: string | null; sub_title?: string | null } | null;
          organization?: { name?: string | null; sub_title?: string | null } | null;
        }
      | null;

    const hName =
      jobPosition?.heltes?.name || jobPosition?.heltes?.sub_title || "";
    const aName =
      jobPosition?.alba?.name || jobPosition?.alba?.sub_title || "";
    const oName =
      jobPosition?.organization?.name ||
      jobPosition?.organization?.sub_title ||
      "";
    if (hName) stats.departments.add(hName);
    if (aName) stats.departments.add(aName);

    if (!clause) return;

    if (!stats.clauses.has(clause.id)) {
      stats.clauses.set(clause.id, {
        id: clause.id,
        text: clause.text,
        reference_number: clause.reference_number,
        jobPositions: [],
      });
    }

    const clauseStats = stats.clauses.get(clause.id)!;

    const ratings = (cjp.ratings as
      | { score: number; scored_date: string | null; description: string | null }[]
      | null) ?? [];

    let latestRating: typeof ratings[number] | null = null;
    if (ratings.length > 0) {
      latestRating = [...ratings].sort(
        (a, b) =>
          new Date(b.scored_date || "").getTime() -
          new Date(a.scored_date || "").getTime(),
      )[0];

      if (latestRating.score !== 6) {
        stats.totalScore += latestRating.score;
        stats.validCount++;
        stats.hasRatings = true;
      }
    }

    const jobPositionStat: PolicyJobPositionStat = {
      id: jobPosition?.id ?? "",
      name: jobPosition?.name || "Нэргүй",
      type: (cjp.type as string | null) ?? null,
      rating: latestRating
        ? { score: latestRating.score, description: latestRating.description }
        : null,
    };

    clauseStats.jobPositions.push(jobPositionStat);

    // Position-аар pivot
    const positionId = jobPosition?.id != null ? String(jobPosition.id) : "";
    if (!positionId) return;

    if (!positionMap.has(positionId)) {
      positionMap.set(positionId, {
        id: positionId,
        name: jobPosition?.name || "Нэргүй",
        organizationName: oName,
        heltesName: hName,
        albaName: aName,
        totalScore: 0,
        validCount: 0,
        linkedCount: 0,
        hasRatings: false,
        policies: new Map(),
      });
    }

    const posStats = positionMap.get(positionId)!;
    posStats.linkedCount++;

    if (latestRating && latestRating.score !== 6) {
      posStats.totalScore += latestRating.score;
      posStats.validCount++;
      posStats.hasRatings = true;
    }

    if (!posStats.policies.has(policyId)) {
      posStats.policies.set(policyId, new Map());
    }
    const posPolicyClauses = posStats.policies.get(policyId)!;
    if (!posPolicyClauses.has(clause.id)) {
      posPolicyClauses.set(clause.id, {
        id: clause.id,
        text: clause.text,
        reference_number: clause.reference_number,
        type: (cjp.type as string | null) ?? null,
        rating: latestRating
          ? { score: latestRating.score, description: latestRating.description }
          : null,
      });
    }
  });

  const processedPolicies: PolicyDashboardItem[] = Array.from(
    policyMap.values(),
  ).map((p) => ({
    id: p.id,
    name: p.name,
    reference_code: p.reference_code,
    approved_date: p.approved_date,
    totalScore: p.totalScore,
    validCount: p.validCount,
    checkedCount: p.checkedCount,
    departments: Array.from(p.departments).join(", "),
    clauses: Array.from(p.clauses.values()),
    hasRatings: p.hasRatings,
    implementationPercent:
      p.validCount > 0
        ? Math.round((p.totalScore / (p.validCount * 5)) * 100)
        : 0,
  }));

  const ratedPolicies = processedPolicies.filter((p) => p.validCount > 0);
  const summary: PolicyDashboardSummary = {
    total: processedPolicies.length,
    ratedCount: ratedPolicies.length,
    unratedCount: processedPolicies.length - ratedPolicies.length,
    avgPercent:
      ratedPolicies.length > 0
        ? Math.round(
            ratedPolicies.reduce((s, p) => s + p.implementationPercent, 0) /
              ratedPolicies.length,
          )
        : 0,
  };

  const processedPositions: JobPositionPerfItem[] = Array.from(
    positionMap.values(),
  ).map((p) => {
    const policies: PositionPolicyGroup[] = Array.from(p.policies.entries())
      .map(([policyId, clauseMap]) => {
        const meta = policyMeta.get(policyId);
        return {
          id: policyId,
          name: meta?.name ?? "Нэргүй",
          reference_code: meta?.reference_code ?? null,
          clauses: Array.from(clauseMap.values()),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "mn"));

    const unitLabel =
      [p.heltesName, p.albaName].filter(Boolean).join(" · ") ||
      p.organizationName ||
      "—";

    return {
      id: p.id,
      name: p.name,
      organizationName: p.organizationName,
      heltesName: p.heltesName,
      albaName: p.albaName,
      unitLabel,
      totalScore: p.totalScore,
      validCount: p.validCount,
      linkedCount: p.linkedCount,
      hasRatings: p.hasRatings,
      implementationPercent:
        p.validCount > 0
          ? Math.round((p.totalScore / (p.validCount * 5)) * 100)
          : 0,
      policies,
    };
  });

  const ratedPositions = processedPositions.filter((p) => p.validCount > 0);
  const positionSummary: JobPositionPerfSummary = {
    total: processedPositions.length,
    ratedCount: ratedPositions.length,
    unratedCount: processedPositions.length - ratedPositions.length,
    avgPercent:
      ratedPositions.length > 0
        ? Math.round(
            ratedPositions.reduce((s, p) => s + p.implementationPercent, 0) /
              ratedPositions.length,
          )
        : 0,
  };

  return {
    policies: processedPolicies,
    summary,
    positions: processedPositions,
    positionSummary,
  };
});

export async function getPolicyDashboardData() {
  return fetchDashboard();
}
