// lib/policyAnalytics.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import {
  ActionType,
  PolicyImplementationStats,
  JobPositionStats,
} from "@/types/stats";

// Журмын хэрэгжилтийн үнэлгээ
export async function getPolicyImplementationStats(
  policyId?: string
): Promise<PolicyImplementationStats[]> {
  const supabase = await createClient();

  let query = supabase
    .from("clause")
    .select(
      `
      id,
      policy_id,
      policy:policy_id (id, name),
      clause_job_positions!inner (
        id,
        ratings!inner (
          score,
          description
        )
      )
      `
    )
    .eq("is_deleted", false);

  if (policyId) {
    query = query.eq("policy_id", policyId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const policyMap = new Map<string, PolicyImplementationStats>();

  data?.forEach((clause: any) => {
    const policyId = clause.policy_id;
    if (!policyMap.has(policyId)) {
      policyMap.set(policyId, {
        policyId,
        policyName: clause.policy.name,
        totalClauses: 0,
        ratedClauses: 0,
        implementationRate: 0,
        averageScore: 0,
      });
    }

    const stats = policyMap.get(policyId)!;
    stats.totalClauses++;

    // 1-5 оноотой үнэлгээний тоог тоолох
    const validRatings = clause.clause_job_positions
      .flatMap((cjp: any) => cjp.ratings)
      .filter((r: any) => r.score >= 1 && r.score <= 5);

    if (validRatings.length > 0) {
      stats.ratedClauses++;
      const averageRating =
        validRatings.reduce((sum: number, r: any) => sum + r.score, 0) /
        validRatings.length;
      stats.averageScore =
        (stats.averageScore * (stats.ratedClauses - 1) + averageRating) /
        stats.ratedClauses;
    }
  });

  Array.from(policyMap.values()).forEach((stats) => {
    stats.implementationRate =
      stats.totalClauses > 0
        ? (stats.ratedClauses / stats.totalClauses) * 100
        : 0;
  });

  return Array.from(policyMap.values());
}

// Ажлын байрын статистик
export async function getJobPositionStats(
  jobPositionId?: string
): Promise<JobPositionStats[]> {
  const supabase = await createClient();

  let query = supabase
    .from("clause_job_position")
    .select(
      `
      id,
      type,
      job_position_id,
      job_position:job_position_id (id, name),
      clause:clause_id (id, text),
      ratings (
        score,
        description
      )
      `
    )
    .eq("is_checked", true);

  if (jobPositionId) {
    query = query.eq("job_position_id", jobPositionId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const jobPositionMap = new Map<string, JobPositionStats>();

  data?.forEach((cjp: any) => {
    const jobPositionId = cjp.job_position_id;
    if (!jobPositionMap.has(jobPositionId)) {
      jobPositionMap.set(jobPositionId, {
        jobPositionId,
        jobPositionName: cjp.job_position.name,
        totalClauses: 0,
        implementationClauses: 0,
        monitoringClauses: 0,
        verificationClauses: 0,
        deploymentClauses: 0,
        averageScore: 0,
        scoresByType: {
          IMPLEMENTATION: [],
          MONITORING: [],
          VERIFICATION: [],
          DEPLOYMENT: [],
        },
      });
    }

    const stats = jobPositionMap.get(jobPositionId)!;
    stats.totalClauses++;

    switch (cjp.type as ActionType) {
      case "IMPLEMENTATION":
        stats.implementationClauses++;
        break;
      case "MONITORING":
        stats.monitoringClauses++;
        break;
      case "VERIFICATION":
        stats.verificationClauses++;
        break;
      case "DEPLOYMENT":
        stats.deploymentClauses++;
        break;
    }

    // Оноог тооцох (зөвхөн 1-5 оноо)
    const validRatings =
      cjp.ratings?.filter((r: any) => r.score >= 1 && r.score <= 5) || [];

    if (validRatings.length > 0) {
      const avgScore =
        validRatings.reduce((sum: number, r: any) => sum + r.score, 0) /
        validRatings.length;
      stats.scoresByType[cjp.type as ActionType].push(avgScore);

      // Ерөнхий дундаж
      const totalScores = Object.values(stats.scoresByType)
        .flat()
        .filter((score) => score > 0);

      stats.averageScore =
        totalScores.length > 0
          ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length
          : 0;
    }
  });

  return Array.from(jobPositionMap.values());
}

// Хэрэгжүүлэлтийн хувь тооцох
export async function calculateImplementationPercentage(
  score: number
): Promise<number> {
  if (score >= 1 && score <= 5) {
    return ((score - 1) / 4) * 100;
  }
  return 0;
}

// 6 оноотой үнэлгээг шалгах
export async function getHighRiskRatings(
  thresholdScore: number = 6
): Promise<any[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("rating")
    .select(
      `
      id,
      score,
      description,
      scored_date,
      clause_job_position:clause_job_position_id (
        id,
        type,
        job_position:job_position_id (name),
        clause:clause_id (text, reference_number, policy:policy_id (name))
      )
      `
    )
    .eq("score", thresholdScore)
    .order("scored_date", { ascending: false });

  if (error) throw error;

  return data || [];
}

// Нэмэлт: Ажлын байрын дэлгэрэнгүй мэдээлэл
export async function getJobPositionDetails(jobPositionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("job_position")
    .select(
      `
      *,
      job_description (*),
      organization:organization_id (name),
      gazar:gazar_id (name)
      `
    )
    .eq("id", jobPositionId)
    .single();

  if (error) throw error;

  return data;
}

// Нэмэлт: Тодорхой журмын бүх заалтуудын үнэлгээ
export async function getPolicyClauseRatings(policyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clause")
    .select(
      `
      id,
      text,
      reference_number,
      clause_job_positions (
        id,
        type,
        job_position:job_position_id (name),
        ratings (
          score,
          description,
          scored_date
        )
      )
      `
    )
    .eq("policy_id", policyId)
    .eq("is_deleted", false);

  if (error) throw error;

  return data;
}

// Нэмэлт: Ажлын байр бүрийн хамгийн муу үнэлгээтэй 3 заалт
export async function getTopWeakClausesByJobPosition(
  jobPositionId: string,
  limit: number = 3
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clause_job_position")
    .select(
      `
      id,
      type,
      clause:clause_id (id, text, reference_number, policy:policy_id (name)),
      ratings (
        score,
        description,
        scored_date
      )
      `
    )
    .eq("job_position_id", jobPositionId)
    .eq("is_checked", true);

  if (error) throw error;

  // Үнэлгээг дундажлаж, хамгийн муу үнэлгээтэйг эрэмбэлэх
  const clausesWithAverage = data
    .map((item: any) => {
      const validRatings =
        item.ratings?.filter((r: any) => r.score >= 1 && r.score <= 5) || [];
      const avgScore =
        validRatings.length > 0
          ? validRatings.reduce((sum: number, r: any) => sum + r.score, 0) /
            validRatings.length
          : 0;

      return {
        ...item,
        averageScore: avgScore,
        ratingCount: validRatings.length,
      };
    })
    .filter((item) => item.ratingCount > 0)
    .sort((a, b) => a.averageScore - b.averageScore) // Өсөх эрэмбээр (хамгийн муу нь эхэнд)
    .slice(0, limit);

  return clausesWithAverage;
}

// Нэмэлт: Нийт үзүүлэлтүүд
export async function getOverallStatistics() {
  const supabase = await createClient();

  // Бүх журмын тоо
  const { data: policies, error: policiesError } = await supabase
    .from("policy")
    .select("id")
    .eq("is_deleted", false);

  if (policiesError) throw policiesError;

  // Бүх ажлын байрын тоо
  const { data: jobPositions, error: jobPositionsError } = await supabase
    .from("job_position")
    .select("id")
    .eq("is_active", true);

  if (jobPositionsError) throw jobPositionsError;

  // Бүх үнэлгээний дундаж
  const { data: ratings, error: ratingsError } = await supabase
    .from("rating")
    .select("score")
    .gte("score", 1)
    .lte("score", 5);

  if (ratingsError) throw ratingsError;

  const totalScore = ratings.reduce((sum, r) => sum + r.score, 0);
  const averageScore = ratings.length > 0 ? totalScore / ratings.length : 0;

  return {
    totalPolicies: policies?.length || 0,
    totalJobPositions: jobPositions?.length || 0,
    totalRatings: ratings?.length || 0,
    averageScore: parseFloat(averageScore.toFixed(2)),
  };
}
