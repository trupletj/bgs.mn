import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getOrderProcess } from "@/actions/order-process";
import OrderProcessForm from "@/components/orders/order-process-form";

interface EditOrderProcessPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditOrderProcessPage({
  params,
}: EditOrderProcessPageProps) {
  const supabase = createClient();
  const { id } = await params;
  const process = await getOrderProcess(Number(id));

  if (!process) {
    notFound();
  }

  const { data: roles } = await supabase
    .from("roles")
    .select("id, display_name")
    .order("display_name");

  const { data: heltes } = await supabase
    .from("heltes")
    .select("bteg_id, name, organization_id")
    .eq("is_active", true)
    .order("name")
    .in("organization_id", ["1", "2", "20"]);

  const { data: companies } = await supabase
    .from("organization")
    .select("bteg_id, name")
    .in("bteg_id", ["1", "2", "20"])
    .order("bteg_id");

  const initialData = {
    id: process.id,
    name: process.name,
    allowed_heltes_ids: process.allowed_heltes_ids,
    purchase_role_ids: process.purchase_role_ids,
    steps: process.steps.map((step) => ({
      step_order: step.step_order,
      step_name: step.step_name,
      role_ids: step.role_ids,
      required_approval_count: step.required_approval_count,
    })),
  };

  return (
    <div className="container mx-auto p-4 w-full ">
      <Button variant="ghost" asChild className="pl-0 mb-6">
        <Link href="/order-processes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Буцах
        </Link>
      </Button>
      <h1 className="text-3xl font-bold mb-2">Захиалгын төрөл засварлах</h1>
      <p className="text-muted-foreground mb-8">
        {process.name} - захиалгын процесс
      </p>
      <OrderProcessForm
        roles={roles || []}
        heltes={(heltes || []).filter((item) => item.bteg_id)}
        companies={(companies || []).filter((item) => item.bteg_id)}
        initialData={initialData}
        isEdit={true}
      />
    </div>
  );
}
