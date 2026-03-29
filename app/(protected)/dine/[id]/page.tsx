import { hasPermission } from "@/actions/rbac";
import notFound from "@/app/not-found";
import UnauthorizedPage from "@/app/unauthorized/page";
import { ChefManager } from "@/components/dine/chef-manager";
import { KioskManager } from "@/components/dine/kiosk-manager";
import { TimeSlotManager } from "@/components/dine/time-slot-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";

interface DinningHallSettingsProps {
  params: Promise<{ id: string }>;
}

export default async function DiningHallSettings({
  params,
}: DinningHallSettingsProps) {
  const { id } = await params;
  const hallId = parseInt(id);
  const is_boss = await hasPermission("dining", "boss");

  if (!is_boss) {
    return <UnauthorizedPage />;
  }

  const is_admin = await hasPermission("admin", "admin");
  const supabase = createClient();

  const { data: hall } = await supabase
    .from("dining_hall")
    .select("*")
    .eq("id", hallId)
    .single();

  if (!hall) return notFound();

  const activeTabsCount = is_admin ? 3 : 2;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{hall.name}</h1>
        <p className="text-muted-foreground">
          Гал тогооны ерөнхий тохиргоо болон төхөөрөмжүүдийн удирдлага
        </p>
      </div>

      <Tabs defaultValue="slots" className="w-full">
        {/* grid-cols-2 эсвэл grid-cols-3 болохыг энд шийдэж байна */}
        <TabsList
          className={`grid w-full ${activeTabsCount === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          <TabsTrigger value="slots">Цагийн хуваарь</TabsTrigger>

          {is_admin && <TabsTrigger value="kiosks">Киоск холболт</TabsTrigger>}

          <TabsTrigger value="chefs">Тогооч</TabsTrigger>
        </TabsList>

        <TabsContent value="slots" className="mt-6">
          <TimeSlotManager hallId={hallId} />
        </TabsContent>

        {is_admin && (
          <TabsContent value="kiosks" className="mt-6">
            <KioskManager hallId={hallId} />
          </TabsContent>
        )}

        <TabsContent value="chefs" className="mt-6">
          <ChefManager hallId={hallId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
