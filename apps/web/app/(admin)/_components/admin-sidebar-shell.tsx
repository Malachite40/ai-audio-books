"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar";
import { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/trpc/react";
import { Badge } from "@workspace/ui/components/badge";

type Item = { title: string; href: string };

export function AdminSidebarShell({
  children,
  items,
}: {
  children: React.ReactNode;
  items: ReadonlyArray<Item>;
}) {
  const pathname = usePathname();
  const { data: unreadCount } = api.support.adminUnreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                    >
                      <Link href={item.href as Route} prefetch className="flex w-full items-center justify-between">
                        <span>{item.title}</span>
                        {item.href === "/admin/support" && (unreadCount ?? 0) > 0 && (
                          <Badge variant="secondary">{unreadCount}</Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger />
          <h1 className="text-lg font-semibold">Admin Panel</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
