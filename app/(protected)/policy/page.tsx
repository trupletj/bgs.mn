import ClientPolicyDashboard from "@/components/client-policy-dashboard";
import { createClient } from "@/utils/supabase/client";

export const revalidate = 0;

export default async function PoliciesPage() {
  const supabase = createClient();

  // 1. Бүх идэвхтэй журмуудыг авна
  const { data: policies } = await supabase
    .from("policy")
    .select("id, name, reference_code, approved_date")
    .eq("is_deleted", false)
    .order("approved_date", { ascending: false });

  if (!policies || policies.length === 0) {
    return <div>Журмын мэдээлэл байхгүй байна.</div>;
  }

  // 2. clause_job_position-оос үнэлгээтэй холболтуудыг авна
  const { data: cjps } = await supabase
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
        alba:alba!alba_id (name, sub_title)
      ),
      ratings:rating!clause_job_position_id (
        score,
        scored_date,
        description
      )
    `,
    )
    .eq("is_checked", true);

  // 3. Ажлын байруудыг dropdown-д
  const { data: jobPositions } = await supabase
    .from("job_position")
    .select(
      "id, name, heltes:heltes!heltes_id(name,sub_title), alba:alba!alba_id(name,sub_title)",
    )
    .eq("is_active", true)
    .order("name");

  // 4. Бүх журмыг Map-д хийнэ (үнэлгээтэй ч бай, байхгүй ч бай)
  const policyMap = new Map<string, any>();

  policies.forEach((policy) => {
    policyMap.set(policy.id, {
      id: policy.id,
      name: policy.name || "Нэргүй",
      reference_code: policy.reference_code,
      approved_date: policy.approved_date,
      totalScore: 0,
      validCount: 0,
      checkedCount: 0,
      departments: new Set<string>(),
      clauses: new Map<string, any>(),
      hasRatings: false, // үнэлгээ хийгдсэн эсэх
    });
  });

  // 5. Үнэлгээтэй холболтуудыг боловсруулна
  cjps?.forEach((cjp: any) => {
    const policyId = cjp.clause?.policy_id;
    if (!policyId || !policyMap.has(policyId)) return;

    const stats = policyMap.get(policyId)!;
    stats.checkedCount++;

    // Хэлтэс/алба цуглуулах
    const hName =
      cjp.job_position?.heltes?.name ||
      cjp.job_position?.heltes?.sub_title ||
      "";
    const aName =
      cjp.job_position?.alba?.name || cjp.job_position?.alba?.sub_title || "";
    if (hName) stats.departments.add(hName);
    if (aName) stats.departments.add(aName);

    const clauseId = cjp.clause?.id;
    if (!clauseId) return;

    if (!stats.clauses.has(clauseId)) {
      stats.clauses.set(clauseId, {
        id: clauseId,
        text: cjp.clause.text,
        reference_number: cjp.clause.reference_number,
        jobPositions: [],
      });
    }

    const clauseStats = stats.clauses.get(clauseId)!;

    let latestRating: any = null;
    if (cjp.ratings?.length > 0) {
      latestRating = cjp.ratings.sort(
        (a: any, b: any) =>
          new Date(b.scored_date || "").getTime() -
          new Date(a.scored_date || "").getTime(),
      )[0];

      if (latestRating.score !== 6) {
        stats.totalScore += latestRating.score;
        stats.validCount++;
        stats.hasRatings = true;
      }
    }

    clauseStats.jobPositions.push({
      id: cjp.job_position?.id,
      name: cjp.job_position?.name || "Нэргүй",
      type: cjp.type || null, // ← Энд type авчирсан!
      rating: latestRating
        ? { score: latestRating.score, description: latestRating.description }
        : null,
    });
  });

  // 6. Бүх журмыг (үнэлгээтэй + үнэлгээгүй) client-д дамжуулна
  const processedPolicies = Array.from(policyMap.values()).map((p: any) => ({
    ...p,
    implementationPercent:
      p.validCount > 0
        ? Math.round((p.totalScore / (p.validCount * 5)) * 100)
        : 0,
    departments: Array.from(p.departments).join(", "),
    clauses: Array.from(p.clauses.values()), // Бүх clause-уудыг өгнө (үнэлгээтэй + үнэлгээгүй)
  }));

  return <ClientPolicyDashboard policies={processedPolicies} />;
}
