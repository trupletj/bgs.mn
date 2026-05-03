import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import OrderProcessForm from "@/components/orders/order-process-form";

export default async function CreateOrderProcessPage() {
  const supabase = createClient();

  const { data: roles } = await supabase
    .from("roles")
    .select("id, display_name")
    .order("display_name");

  const { data: heltes } = await supabase
    .from("heltes")
    .select("bteg_id, name, organization_id")
    .eq("is_active", true)
    .in("organization_id", ["1", "2", "20"])
    .order("name");

  const { data: companies } = await supabase
    .from("organization")
    .select("bteg_id, name")
    .in("bteg_id", ["1", "2", "20"])
    .order("bteg_id");

  return (
    <div className="container mx-auto p-4 w-full">
      <Button variant="ghost" asChild className="pl-0 mb-6">
        <Link href="/order-processes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Буцах
        </Link>
      </Button>
      <h1 className="text-3xl font-bold mb-2">Шинэ захиалгын төрөл үүсгэх</h1>
      <p className="text-muted-foreground mb-8">
        Захиалгын процессын шинэ төрөл үүсгэх
      </p>
      <OrderProcessForm
        roles={roles || []}
        heltes={(heltes || []).filter((item) => item.bteg_id)}
        companies={(companies || []).filter((item) => item.bteg_id)}
        isEdit={false}
      />
    </div>
  );
}
