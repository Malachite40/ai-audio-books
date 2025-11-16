"use client";

import Link from "next/link";

import { api } from "@/trpc/react";
import { WatchedSubreddit } from "@workspace/database";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { CampaignEvaluationChart } from "../_components/campaign-evaluation-chart";
import { CampaignEvaluationList } from "../_components/campaign-evaluation-list";
import { CampaignSummaryCard } from "../_components/campaign-summary-card";
import { CampaignWatchedSubredditsCard } from "../_components/campaign-watched-subreddits-card";
import { SubredditFinder } from "../_components/subreddit-finder";

type CampaignClientProps = {
  campaignId: string;
};

export function CampaignClientPage({ campaignId }: CampaignClientProps) {
  const { data, isLoading, error, refetch } =
    api.reddit.campaigns.fetch.useQuery({
      id: campaignId,
    });
  const campaign = data?.campaign;

  const { data: scoreShares } =
    api.reddit.evaluations.getHighScoreShareForCampaign.useQuery({
      campaignId,
      days: 30,
    });

  const totalReach =
    campaign?.watchedSubreddit?.reduce(
      (sum: number, watch: WatchedSubreddit) => {
        const value = typeof watch.reach === "number" ? watch.reach : 0;
        return sum + value;
      },
      0
    ) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href="/admin/leads"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Leads
          </Link>
        </div>
      </div>

      {error ? (
        <Card className="p-6">
          <div className="space-y-2">
            <div className="font-medium">Failed to load campaign.</div>
            <div className="text-sm text-muted-foreground">{error.message}</div>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </Card>
      ) : isLoading ? (
        <Card className="p-6 text-muted-foreground">Loading campaign…</Card>
      ) : !campaign ? (
        <Card className="p-6 text-muted-foreground">Campaign not found.</Card>
      ) : (
        <>
          <CampaignSummaryCard
            campaign={campaign}
            watchedSubredditsCount={campaign._count?.watchedSubreddit}
            evaluationsCount={campaign._count?.evaluations}
            totalReach={totalReach}
          />

          <Tabs defaultValue="evaluations" className="space-y-4">
            <TabsList>
              <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
              <TabsTrigger value="subreddits">Subreddits</TabsTrigger>
            </TabsList>
            <TabsContent value="evaluations" className="space-y-4">
              <CampaignEvaluationChart campaignId={campaignId} />
              <CampaignEvaluationList campaignId={campaignId} />
            </TabsContent>
            <TabsContent value="subreddits" className="space-y-4">
              <CampaignWatchedSubredditsCard
                campaignId={campaignId}
                watchedSubreddits={campaign.watchedSubreddit ?? []}
                scoreShares={scoreShares?.items ?? []}
              />
              <SubredditFinder campaignId={campaignId} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
