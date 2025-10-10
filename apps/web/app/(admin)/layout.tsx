"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Route } from "next"
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
} from "@workspace/ui/components/sidebar"

type AdminLayoutProps = {
  children: React.ReactNode
}

const items = [
  { title: "Speakers", href: "/admin/speakers" },
  { title: "Audio Files", href: "/admin/audio" },
  { title: "Key-Value", href: "/admin/kv" },
  { title: "Re-Stitch Audio", href: "/admin/restitch" },
  { title: "Support Submissions", href: "/admin/support" },
  { title: "Credit Transactions", href: "/admin/credits" },
  { title: "Debug", href: "/admin/debug" },
] as const satisfies ReadonlyArray<{ title: string; href: Route }>

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()

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
  )
}
