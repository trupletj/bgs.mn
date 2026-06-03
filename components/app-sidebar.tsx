"use client";

import * as React from "react";
import {
  IconLayoutDashboard,
  IconClipboardList,
  IconToolsKitchen2,
  IconUsers,
  IconFileText,
  IconShield,
  IconClockHour4,
  IconBus,
  IconBriefcase,
  type Icon,
} from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

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

// Brand components импортлох
import { BgsWordmark } from "@/components/brand/bgs-wordmark";
import { ORBIT_COLORS } from "@/components/brand/orbit-mark"; // C-г ашиглахын тулд оруулж ирнэ

const serviceIcons: Record<string, Icon> = {
  dashboard: IconLayoutDashboard,
  attendance: IconClockHour4,
  eelj: IconBus,
  orders: IconClipboardList,
  dine: IconToolsKitchen2,
  employees: IconUsers,
  policy: IconFileText,
  "job-descriptions": IconBriefcase,
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
              className="h-auto gap-3 rounded-xl px-2 py-2 hover:bg-sidebar-accent transition-colors">
              <Link href="/dashboard" className="flex items-center gap-3">
                <AppIcon
                  px={36}
                  radiusPct={22.5}
                  bg={ORBIT_COLORS.paper}
                  ring={ORBIT_COLORS.ink}
                  node={ORBIT_COLORS.accent}
                  gap={ORBIT_COLORS.ink}
                />

                <div className="flex flex-col justify-center gap-1">
                  <BgsWordmark size={18} color={ORBIT_COLORS.paper} />
                  <span className="text-[10px] font-medium uppercase tracking-widest ">
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
                const ServiceIcon =
                  serviceIcons[service.key] ?? IconLayoutDashboard;
                const isActive = service.basePaths.some((base) =>
                  pathname.startsWith(base),
                );
                return (
                  <SidebarMenuItem key={service.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={service.title}
                      className="h-9 gap-3 rounded-lg px-3 text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm">
                      <Link href={service.url}>
                        <ServiceIcon className="h-[18px] w-[18px] shrink-0" />
                        <span>{service.title}</span>
                        {!!service.badgeCount && service.badgeCount > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground ml-auto">
                            {service.badgeCount}
                          </span>
                        )}
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

// AppIcon component-ийг яг хэвээр нь үлдээв
function AppIcon({
  px,
  radiusPct,
  bg,
  ring,
  node,
  gap,
}: {
  px: number;
  radiusPct: number;
  bg: string;
  ring: string;
  node: string;
  gap: string;
}) {
  return (
    <div
      style={{
        width: px,
        height: px,
        background: bg,
        borderRadius: (radiusPct / 100) * px,
        boxShadow: "0 4px 14px rgba(0,0,0,0.06)", // Сүүдрийг бага зэрэг зөөллөв
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
      <svg width={px * 0.6} height={px * 0.6} viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="44" stroke={ring} strokeWidth="11.4" />
        <circle cx="91.1" cy="28.9" r="20" fill={gap} />
        <circle cx="91.1" cy="28.9" r="13" fill={node} />
      </svg>
    </div>
  );
}
