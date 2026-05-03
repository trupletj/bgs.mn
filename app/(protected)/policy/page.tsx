import { getPolicyDashboardData } from "@/actions/policy-dashboard";
import { PolicyDashboard } from "@/components/policy/policy-dashboard";
import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const revalidate = 0;

export default async function PoliciesPage() {
  const { policies, summary, positions, positionSummary } =
    await getPolicyDashboardData();

  if (policies.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Аудит / Хяналт
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Журмын хэрэгжилт
          </h1>
        </div>
        <Card className="items-center gap-2 px-4 py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">
            Журмын мэдээлэл байхгүй байна
          </p>
          <p className="text-sm text-muted-foreground">
            Эхний журам үүсгэснээр энд харагдана
          </p>
        </Card>
      </div>
    );
  }

  return (
    <PolicyDashboard
      policies={policies}
      summary={summary}
      positions={positions}
      positionSummary={positionSummary}
    />
  );
}
