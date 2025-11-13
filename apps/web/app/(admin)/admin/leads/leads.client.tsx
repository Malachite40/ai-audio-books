"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { CampaignManagement } from "../campaign/_components/campaign-management";
import { LeadsPosts } from "./_components/leads-posts";
import { LeadsTools } from "./_components/leads-tools";

export function LeadsClientPage() {
  return (
    <div className="space-y-6 container mx-auto">
      <Tabs defaultValue="eval">
        <TabsList>
          <TabsTrigger value="eval">Campaigns</TabsTrigger>
          <TabsTrigger value="posts">Reddit Posts</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>
        <TabsContent value="eval" className="space-y-4">
          <CampaignManagement />
        </TabsContent>
        <TabsContent value="posts" className="space-y-4">
          <LeadsPosts />
        </TabsContent>
        <TabsContent value="tools" className="space-y-4">
          <LeadsTools />
        </TabsContent>
      </Tabs>
    </div>
  );
}
