import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getOrdersByUser } from "@/actions/orders";
import { getProfileIdFromAuthUserId } from "@/actions/profile";
import { OrdersList } from "@/components/orders/OrdersList";
import { RequestedList } from "@/components/orders/requested-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusIcon, ClipboardList, Clock, CheckCircle2 } from "lucide-react";

export default async function OrdersPage() {
  const orders = await getOrdersByUser();
  const profile_id = await getProfileIdFromAuthUserId();

  return (
    <div className="container mx-auto p-6 max-w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Сэлбэг захиалгууд
          </h1>
          <p className="text-muted-foreground mt-1">
            Захиалгын явц болон хяналтын мэдээлэл
          </p>
        </div>
        <Link href="/orders/add">
          <Button className="shadow-md">
            <PlusIcon className="h-4 w-4 mr-2" />
            Шинэ захиалга үүсгэх
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="my-orders" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-2 h-12 bg-gray-100/50 p-1">
          <TabsTrigger
            value="my-orders"
            className="flex items-center gap-2 py-2">
            <ClipboardList className="h-4 w-4" />
            <span>Миний илгээсэн</span>
          </TabsTrigger>
          <TabsTrigger
            value="pending-review"
            className="flex items-center gap-2 py-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <span>Хянагдах хүлээгдэж буй</span>
          </TabsTrigger>
          <TabsTrigger
            value="reviewed"
            className="flex items-center gap-2 py-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Миний хянасан</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. Миний илгээсэн захиалгууд */}
        <TabsContent value="my-orders" className="space-y-4 outline-none">
          <div className="bg-white rounded-xl">
            {!orders ? (
              <div className="animate-pulse bg-gray-100 h-64 rounded-xl" />
            ) : (
              <OrdersList orders={orders.data ?? []} />
            )}
          </div>
        </TabsContent>

        {/* 2. Хянагдах хүлээгдэж буй */}
        <TabsContent value="pending-review" className="space-y-4 outline-none">
          <RequestedList profile_id={profile_id} type="pending" />
        </TabsContent>

        {/* 3. Миний хянасан захиалгууд */}
        <TabsContent value="reviewed" className="space-y-4 outline-none">
          <RequestedList profile_id={profile_id} type="reviewed" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
