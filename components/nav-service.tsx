"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type {
  NavService as NavServiceType,
  NavSubItem,
} from "@/actions/nav";

function isItemActive(pathname: string, item: NavSubItem) {
  return pathname === item.url || pathname.startsWith(item.url + "/");
}

function isParentItemActive(
  pathname: string,
  item: NavSubItem,
  childItems: NavSubItem[],
) {
  if (childItems.length === 0) return isItemActive(pathname, item);
  return (
    pathname === item.url ||
    childItems.some((child) => isItemActive(pathname, child))
  );
}

export function NavService({ services }: { services: NavServiceType[] }) {
  const pathname = usePathname();

  const activeService = services.find((s) =>
    s.basePaths.some((base) => pathname.startsWith(base))
  );

  if (!activeService || activeService.items.length === 0) return null;

  return (
    <SidebarGroup className="mt-1">
      <SidebarGroupLabel className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
        {activeService.title}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {activeService.items.map((item) => {
            const childItems = item.items ?? [];
            const hasChildren = childItems.length > 0;
            const isActive = isParentItemActive(pathname, item, childItems);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className="h-8 gap-3 rounded-lg px-3 text-[13px] text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium"
                >
                  <Link href={item.url}>
                    <span className="ml-1 flex-1 truncate">{item.title}</span>
                    {!!item.badgeCount && item.badgeCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                        {item.badgeCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
                {hasChildren && (
                  <SidebarMenuSub>
                    {childItems.map((child) => {
                      const isChildActive = isItemActive(pathname, child);
                      return (
                        <SidebarMenuSubItem key={child.url}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isChildActive}
                            size="sm"
                            className="text-sidebar-foreground/55 data-[active=true]:font-medium"
                          >
                            <Link href={child.url}>
                              <span>{child.title}</span>
                              {!!child.badgeCount &&
                                child.badgeCount > 0 && (
                                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                                    {child.badgeCount}
                                  </span>
                                )}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
