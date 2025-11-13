"use client";

import Link from "next/link";

import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
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
          <h1 className="text-2xl font-semibold">Campaign</h1>
          <p className="text-sm text-muted-foreground">
            Manage watched subreddits for this campaign.
          </p>
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
          />

          <CampaignEvaluationChart campaignId={campaignId} />

          <CampaignEvaluationList campaignId={campaignId} />

          <CampaignWatchedSubredditsCard
            campaignId={campaignId}
            watchedSubreddits={campaign.watchedSubreddit ?? []}
          />

          <SubredditFinder campaignId={campaignId} />
        </>
      )}
    </div>
  );
}
