import { Suspense } from "react";
import { OrderCreateForm } from "@/components/orders/order-create-form";
import { getOrderProcessesForCurrentUser } from "@/actions/order-process";
import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";

export const dynamic = "force-dynamic";

export default async function CreateOrderTestPage() {
  const processes = await getOrderProcessesForCurrentUser();
  const canCreate = await hasPermission("order", "create");

  if (!canCreate) {
    return <UnauthorizedPage />;
  }

  return (
    <main className="container mx-auto py-6 px-4 w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Эд ангиудын захиалга үүсгэх
        </h1>
        <p className="text-gray-600 mt-2">
          Шаардлагатай тоног төхөөрөмжийн эд ангиудын захиалга үүсгэх
        </p>
      </div>

      <Suspense
        fallback={
          <div className="animate-pulse bg-gray-200 h-96 rounded-lg" />
        }>
        <OrderCreateForm orderProcesses={processes} />
      </Suspense>
    </main>
  );
}
