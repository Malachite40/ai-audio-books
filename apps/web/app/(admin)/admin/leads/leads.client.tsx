"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { LeadsEvaluations } from "./_components/leads-evaluations";
import { LeadsPosts } from "./_components/leads-posts";

export function LeadsClientPage() {
  return (
    <div className="space-y-4 container mx-auto ">
      <Tabs defaultValue="eval">
        <TabsList>
          <TabsTrigger value="eval">Watch List + Evaluations</TabsTrigger>
          <TabsTrigger value="posts">Reddit Posts</TabsTrigger>
        </TabsList>
        <TabsContent value="eval" className="space-y-4">
          <LeadsEvaluations />
        </TabsContent>
        <TabsContent value="posts" className="space-y-4">
          <LeadsPosts />
        </TabsContent>
      </Tabs>
    </div>
  );
}

