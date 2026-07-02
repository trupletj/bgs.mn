import { Bus } from "lucide-react";
import { getPublicBusRoster } from "@/actions/bus-roster-public";
import { PublicRosterSearch } from "@/components/shift-exchange/public-roster-search";

// Session/нэвтрэлт шаардахгүй public хуудас — (protected) route group-ийн
// ГАДНА байрлах тул app/(protected)/layout.tsx-ийн auth redirect-д өртөхгүй.
export default async function PublicBusRosterPage() {
  const rows = await getPublicBusRoster();

  return (
    <div className="flex min-h-svh w-full flex-col gap-6 p-4 lg:p-8">
      <div>
        <div className="flex items-center gap-2">
          <Bus className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Автобусны хуваарилалт
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Өөрийн нэрээр хайж ямар автобусанд хуваарилагдсанаа шалгана уу.
        </p>
      </div>

      <PublicRosterSearch rows={rows} />
    </div>
  );
}
