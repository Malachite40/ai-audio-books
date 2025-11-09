"use client";

import { FullScreenSignIn } from "@/components/sign-in";
import { api } from "@/trpc/server";
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
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminLayoutProps = {
  children: React.ReactNode;
};

const items = [
  { title: "Stats", href: "/admin/stats" },
  { title: "Speakers", href: "/admin/speakers" },
  { title: "Users", href: "/admin/users" },
  { title: "Audio Files", href: "/admin/audio" },
  { title: "Key-Value", href: "/admin/kv" },
  { title: "Support Submissions", href: "/admin/support" },
  { title: "Credit Transactions", href: "/admin/credits" },
  { title: "Debug", href: "/admin/debug" },
] as const satisfies ReadonlyArray<{ title: string; href: Route }>;

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const { user } = await api.users.self();
  if (!user) {
    return <FullScreenSignIn />;
  }

  if (user.role !== "admin") {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <h1 className="text-2xl font-bold">
          You do not have access to this page
        </h1>
      </div>
    );
  }
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
                      <Link href={item.href} prefetch>
                        <span>{item.title}</span>
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
