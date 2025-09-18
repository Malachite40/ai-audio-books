"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
// ...existing code...
import { AdminSpeakersCard } from "./_components/admin-speakers";
import { ReStitchForm } from "./_components/re-stitch";
import { SupportSubmissionsCard } from "./_components/support-submissions-card";

export type AdminClientPageProps = {};

export function AdminClientPage(props: AdminClientPageProps) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
      <Tabs defaultValue="speakers" className="w-full">
        <TabsList>
          <TabsTrigger value="speakers">Speakers</TabsTrigger>
          <TabsTrigger value="restitch">Re-Stitch Audio</TabsTrigger>
          <TabsTrigger value="support">Support Submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="speakers">
          <AdminSpeakersCard />
        </TabsContent>
        <TabsContent value="restitch">
          <ReStitchForm />
        </TabsContent>
        <TabsContent value="support">
          <SupportSubmissionsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
