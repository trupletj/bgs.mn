import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { OrdersList } from "@/components/orders/OrdersList";


export const dynamic = "force-dynamic";

export default function OrdersPage() {
  return (
    <main className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipment Parts Orders</h1>
          <p className="text-gray-600 mt-2">
            Manage and track equipment parts orders and requests.
          </p>
        </div>
        <Link href="/orders/create">
          <Button>
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Order
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="animate-pulse bg-gray-200 h-64 rounded-lg" />}>
        <OrdersList />
      </Suspense>
    </main>
  );
}