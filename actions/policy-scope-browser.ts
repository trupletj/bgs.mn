import { createClient } from "@/utils/supabase/server";

export type PolicyScopeBrowserType = "alba" | "heltes";

export interface PolicyScopeBrowserPolicy {
  id: string;
  name: string | null;
  reference_code: string | null;
  approved_date: string | null;
}

export interface PolicyScopeBrowserGroup {
  bteg_id: string;
  name: string;
  policies: PolicyScopeBrowserPolicy[];
}

interface ScopeRow {
  bteg_id: string | null;
  name: string | null;
}

interface PolicyScopeTargetRow {
  policy_id: string;
  target_bteg_id: string;
}

export function isPolicyScopeBrowserType(
  value: string,
): value is PolicyScopeBrowserType {
  return value === "alba" || value === "heltes";
}

export function getPolicyScopeBrowserLabel(type: PolicyScopeBrowserType) {
  return type === "alba" ? "Алба" : "Хэлтэс";
}

export async function getPolicyScopeBrowserGroups(
  type: PolicyScopeBrowserType,
): Promise<PolicyScopeBrowserGroup[]> {
  const supabase = await createClient();
  const scopeTable = type === "alba" ? "alba" : "heltes";

  const { data: scopeRows, error: scopeError } = await supabase
    .from(scopeTable)
    .select("bteg_id, name")
    .eq("is_active", true)
    .eq("organization_id", "1")
    .order("name");

  if (scopeError) {
    throw new Error(
      `${getPolicyScopeBrowserLabel(type)} авахад алдаа: ${scopeError.message}`,
    );
  }

  const scopes = ((scopeRows ?? []) as ScopeRow[]).filter(
    (scope): scope is { bteg_id: string; name: string | null } =>
      Boolean(scope.bteg_id),
  );

  const { data: targetRows, error: targetError } = await supabase
    .from("policy_scope_targets")
    .select("policy_id, target_bteg_id")
    .eq("target_type", type);

  if (targetError) {
    throw new Error(`Журмын харьяалал авахад алдаа: ${targetError.message}`);
  }

  const targets = (targetRows ?? []) as PolicyScopeTargetRow[];
  const policyIds = Array.from(new Set(targets.map((row) => row.policy_id)));
  const policiesById = new Map<string, PolicyScopeBrowserPolicy>();

  if (policyIds.length > 0) {
    const { data: policyRows, error: policyError } = await supabase
      .from("policy")
      .select("id, name, reference_code, approved_date")
      .in("id", policyIds)
      .eq("is_deleted", false)
      .order("approved_date", { ascending: false });

    if (policyError) {
      throw new Error(`Журмын жагсаалт авахад алдаа: ${policyError.message}`);
    }

    ((policyRows ?? []) as PolicyScopeBrowserPolicy[]).forEach((policy) => {
      policiesById.set(policy.id, policy);
    });
  }

  const policyIdsByScope = targets.reduce((acc, target) => {
    if (!policiesById.has(target.policy_id)) return acc;
    const current = acc.get(target.target_bteg_id) ?? [];
    current.push(target.policy_id);
    acc.set(target.target_bteg_id, current);
    return acc;
  }, new Map<string, string[]>());

  return scopes.map((scope) => {
    const scopedPolicyIds = policyIdsByScope.get(scope.bteg_id) ?? [];
    const policies = scopedPolicyIds
      .map((policyId) => policiesById.get(policyId))
      .filter((policy): policy is PolicyScopeBrowserPolicy => Boolean(policy));

    return {
      bteg_id: scope.bteg_id,
      name: scope.name || scope.bteg_id,
      policies,
    };
  });
}
