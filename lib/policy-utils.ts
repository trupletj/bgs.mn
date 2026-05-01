export interface PolicyJobPositionStat {
  id: string | number;
  name: string;
  type: string | null;
  rating: { score: number; description: string | null } | null;
}

export interface PolicyClauseStat {
  id: string | number;
  text: string | null;
  reference_number: string | null;
  jobPositions: PolicyJobPositionStat[];
}

export interface PolicyDashboardItem {
  id: string;
  name: string;
  reference_code: string | null;
  approved_date: string | null;
  totalScore: number;
  validCount: number;
  checkedCount: number;
  departments: string;
  clauses: PolicyClauseStat[];
  hasRatings: boolean;
  implementationPercent: number;
}

export interface PolicyDashboardSummary {
  total: number;
  ratedCount: number;
  unratedCount: number;
  avgPercent: number;
}

export function formatPolicyDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function policyStatusVariant(percent: number): {
  label: string;
  badge: string;
  bar: string;
  fill: string;
} {
  if (percent >= 90)
    return {
      label: "Сайн",
      badge: "bg-emerald-100 text-emerald-700",
      bar: "bg-emerald-500",
      fill: "#10B981",
    };
  if (percent >= 70)
    return {
      label: "Дундаж",
      badge: "bg-amber-100 text-amber-700",
      bar: "bg-amber-500",
      fill: "#F59E0B",
    };
  return {
    label: "Тааруу",
    badge: "bg-rose-100 text-rose-700",
    bar: "bg-rose-500",
    fill: "#F43F5E",
  };
}

export function sortByReferenceNumber<
  T extends { reference_number: string | null },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const partsA = (a.reference_number || "").split(".").map(Number);
    const partsB = (b.reference_number || "").split(".").map(Number);
    const maxLength = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < maxLength; i++) {
      const partA = partsA[i] ?? 0;
      const partB = partsB[i] ?? 0;
      if (partA !== partB) return partA - partB;
    }
    return 0;
  });
}
