import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { hasPermission } from "@/actions/rbac";
import { getPolicyPickerData } from "@/actions/policy-legal-acts";
import UnauthorizedPage from "@/app/unauthorized/page";
import { LegalActForm } from "@/components/policy/legal-acts/legal-act-form";
import { Button } from "@/components/ui/button";

export const revalidate = 0;

export default async function NewLegalActPage() {
  const canCreate = await hasPermission("policy", "create");
  if (!canCreate) return <UnauthorizedPage />;

  const policies = await getPolicyPickerData();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon-sm">
          <Link href="/policy/legal-acts">
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
          Эрх зүйн акт нэмэх
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          03 тушаалыг бүртгэл хэлбэрээр, 04 тушаалыг журмын шинэчлэлтэй холбоно
        </p>
      </div>

      <LegalActForm policies={policies} />
    </div>
  );
}
