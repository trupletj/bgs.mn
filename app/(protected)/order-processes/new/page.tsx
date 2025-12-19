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
      <OrderProcessForm roles={roles || []} isEdit={false} />
    </div>
  );
}
