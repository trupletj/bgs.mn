import { getOrderProcesses } from "@/actions/order-process";
import OrderProcessList from "@/components/orders/order-process-type-list";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function OrderProcessesPage() {
  const res = await getOrderProcesses();
  const processes = Array.isArray(res) ? res : (res?.data ?? []);

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Захиалгын төрлүүд</h1>
          <p className="text-muted-foreground mt-2">
            Захиалгын процессуудыг удирдах, шинэ төрөл үүсгэх
          </p>
        </div>
        <Button asChild>
          <Link href="/order-processes/new">
            <Plus className="mr-2 h-4 w-4" />
            Шинэ төрөл
          </Link>
        </Button>
      </div>

      <OrderProcessList initialProcesses={processes} />
    </div>
  );
}
