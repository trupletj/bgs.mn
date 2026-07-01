import { getProfileInfo } from "@/actions/profile";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const profile = await getProfileInfo();

  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/60 bg-background/95 backdrop-blur-sm transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
        <Separator
          orientation="vertical"
          className="mx-1 data-[orientation=vertical]:h-4"
        />

        {/* Greeting */}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            Сайн байна уу,{" "}
            <span className="text-primary">{profile.name}</span>
          </p>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            <span className="sr-only">Мэдэгдэл</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
