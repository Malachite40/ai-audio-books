"use client";

import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent } from "@workspace/ui/components/tabs";
// ...existing code...
import { AdminSpeakersCard } from "./_components/admin-speakers";
import { AdminKeyValueCard } from "./_components/admin-kv";
import { DebugInfoCard } from "./_components/debug-info-card";
import { ReStitchForm } from "./_components/re-stitch";
import { SupportSubmissionsCard } from "./_components/support-submissions-card";
import { CreditTransactionsCard } from "./_components/credit-transactions-card";

export type AdminClientPageProps = {};

export function AdminClientPage(props: AdminClientPageProps) {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") ?? "speakers") as
    | "speakers"
    | "kv"
    | "restitch"
    | "support"
    | "credits"
    | "debug";

  return (
    <div className="container mx-auto p-4">
      <Tabs value={tab} className="w-full">
        <TabsContent value="speakers">
          <AdminSpeakersCard />
        </TabsContent>
        <TabsContent value="kv">
          <AdminKeyValueCard />
        </TabsContent>
        <TabsContent value="restitch">
          <ReStitchForm />
        </TabsContent>
        <TabsContent value="support">
          <SupportSubmissionsCard />
        </TabsContent>
        <TabsContent value="credits">
          <CreditTransactionsCard />
        </TabsContent>
        <TabsContent value="debug">
          <DebugInfoCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
