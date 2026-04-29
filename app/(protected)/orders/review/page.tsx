import { getAwaitingOrders } from "@/actions/orders";
import { getProfileIdFromAuthUserId } from "@/actions/profile";
import { RequestedList } from "@/components/orders/requested-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle2, ShieldCheck } from "lucide-react";

export default async function OrderReviewPage() {
  const profile_id = await getProfileIdFromAuthUserId();
  const allAwaiting = (await getAwaitingOrders(profile_id)) || [];

  const pending  = allAwaiting.filter((r) => r.status === "pending" || !r.status);
  const reviewed = allAwaiting.filter((r) => r.status && r.status !== "pending");

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Захиалгын модуль
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Хяналт
          </h1>
        </div>
        {pending.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2">
            <Clock className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">
              {pending.length} захиалга хүлээгдэж байна
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="h-auto w-full gap-0 rounded-xl bg-muted p-1 sm:w-auto">
          <TabsTrigger
            value="pending"
            className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Хянах хүлээгдэж буй</span>
            <span className="sm:hidden">Хүлээгдэж буй</span>
            {pending.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
                {pending.length}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="reviewed"
            className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Миний хянасан</span>
            <span className="sm:hidden">Хянасан</span>
            {reviewed.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-[11px] font-semibold text-muted-foreground">
                {reviewed.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="pending" className="mt-0 outline-none">
            <RequestedList
              initialData={pending}
              profile_id={profile_id}
              type="pending"
            />
          </TabsContent>

          <TabsContent value="reviewed" className="mt-0 outline-none">
            <RequestedList
              initialData={reviewed}
              profile_id={profile_id}
              type="reviewed"
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
