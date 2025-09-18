import { Suspense } from "react";
import { OrderCreationForm } from "@/components/orders/OrderCreationForm";

export const dynamic = "force-dynamic";

export default function CreateOrderPage() {
  return (
    <main className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Create New Parts Order</h1>
        <p className="text-gray-600 mt-2">
          Create a new equipment parts order with detailed specifications and requirements.
        </p>
      </div>

      <Suspense fallback={<div className="animate-pulse bg-gray-200 h-96 rounded-lg" />}>
        <OrderCreationForm />
      </Suspense>
    </main>
  );
}