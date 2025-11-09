"use server";

import { FullScreenSignIn } from "@/components/sign-in";
import { api } from "@/trpc/server";
import type { Route } from "next";
import { AdminSidebarShell } from "./_components/admin-sidebar-shell";

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
  return <AdminSidebarShell items={items}>{children}</AdminSidebarShell>;
}
