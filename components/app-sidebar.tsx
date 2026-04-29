"use client";

import * as React from "react";
import {
  IconLayoutDashboard,
  IconClipboardList,
  IconToolsKitchen2,
  IconUsers,
  IconFileText,
  IconShield,
  type Icon,
} from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

import { NavService } from "@/components/nav-service";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import type { NavService as NavServiceType } from "@/actions/nav";
import Link from "next/link";

const serviceIcons: Record<string, Icon> = {
  dashboard: IconLayoutDashboard,
  orders: IconClipboardList,
  dine: IconToolsKitchen2,
  employees: IconUsers,
  policy: IconFileText,
  admin: IconShield,
};

export function AppSidebar({
  services,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  services: NavServiceType[];
  user: { name: string; email: string; avatar: string };
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* Brand header */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-auto gap-3 rounded-xl px-2 py-2 hover:bg-sidebar-accent"
            >
              <Link href="/dashboard">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-white/10">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <div className="grid leading-none">
                  <span className="text-sm font-semibold text-sidebar-foreground">
                    BGS систем
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/40">
                    Удирдлагын платформ
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {services.map((service) => {
                const ServiceIcon = serviceIcons[service.key] ?? IconLayoutDashboard;
                const isActive = service.basePaths.some((base) =>
                  pathname.startsWith(base)
                );
                return (
                  <SidebarMenuItem key={service.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={service.title}
                      className="h-9 gap-3 rounded-lg px-3 text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-primary data-[active=true]:text-white data-[active=true]:shadow-sm"
                    >
                      <Link href={service.url}>
                        <ServiceIcon className="h-[18px] w-[18px] shrink-0" />
                        <span>{service.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sub-navigation for active section */}
        <NavService services={services} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
