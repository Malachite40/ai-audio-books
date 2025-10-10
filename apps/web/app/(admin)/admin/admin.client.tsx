"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
// ...existing code...
import { AdminSpeakersCard } from "./_components/admin-speakers";
import { AdminKeyValueCard } from "./_components/admin-kv";
import { DebugInfoCard } from "./_components/debug-info-card";
import { ReStitchForm } from "./_components/re-stitch";
import { SupportSubmissionsCard } from "./_components/support-submissions-card";
import { CreditTransactionsCard } from "./_components/credit-transactions-card";

export type AdminClientPageProps = {};

export function AdminClientPage(props: AdminClientPageProps) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
      <Tabs defaultValue="speakers" className="w-full">
        <TabsList>
          <TabsTrigger value="speakers">Speakers</TabsTrigger>
          <TabsTrigger value="kv">Key-Value</TabsTrigger>
          <TabsTrigger value="restitch">Re-Stitch Audio</TabsTrigger>
          <TabsTrigger value="support">Support Submissions</TabsTrigger>
          <TabsTrigger value="credits">Credit Transactions</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>
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
