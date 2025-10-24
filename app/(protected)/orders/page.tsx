import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { OrdersList } from "@/components/orders/OrdersList";
import { getOrdersByUser } from "@/actions/orders";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewRequestsList } from "@/components/review-requests-list";
import { getProfileIdFromAuthUserId } from "@/actions/review";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await getOrdersByUser();
  const profile_id = await getProfileIdFromAuthUserId();

  return (
    <div className="py-6 px-4">
      <h1 className="text-3xl font-bold text-gray-900 text-center">
        Сэлбэг захиалгууд
      </h1>
      <Separator className="my-2" />
      <div className="container mx-auto py-3 px-2">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Таны илгээсэн захиалгууд
            </h2>
            <p className="text-gray-600 mt-2">
              Та өөрийн илгээсэн захиалгуудаа доорх жагсаалтаас харах боломжтой.
            </p>
          </div>
          <Link href="/orders/new">
            <Button>
              <PlusIcon className="h-4 w-4 mr-2" />
              Захиалга үүсгэх
            </Button>
          </Link>
        </div>

        {!orders ? (
          <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />
        ) : (
          <OrdersList orders={orders.data ?? []} />
        )}
      </div>

      <Separator className="my-2" />
      <div className="py-3 px-2">
        <div className="mb-2">
          <h2 className="text-2xl font-bold text-gray-900">
            Танд хянагдах захиалгууд
          </h2>
          <p className="text-gray-600 mt-2">
            Та өөрийн хянах захиалгуудаа доорх жагсаалтаас харах боломжтой.
          </p>
        </div>
        <ReviewRequestsList profile_id={profile_id} />
      </div>
    </div>
  );
}
