"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ResponsiveModal } from "@/components/resonpsive-modal";
import { api } from "@/trpc/react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Loader2, PlusIcon } from "lucide-react";
import { CampaignForm } from "./campaign-form";

export function CampaignManagement() {
  const { data, isLoading, error, refetch } =
    api.reddit.campaigns.fetchAll.useQuery();
  const campaigns = useMemo(() => data?.items ?? [], [data?.items]);

  const [createOpen, setCreateOpen] = useState(false);
  const handleCreated = async () => {
    await refetch();
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Choose a campaign to manage watched subreddits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon className="mr-2 size-4" />
            New campaign
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="p-6 flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Failed to load campaigns.</div>
            <div className="text-sm text-muted-foreground">
              {error.message || "Unknown error"}
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      ) : isLoading ? (
        <Card className="p-6 text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Loading campaigns…
        </Card>
      ) : campaigns.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground border-dashed">
          No campaigns yet. Create your first one to start watching subreddits.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/admin/campaign/${campaign.id}`}
              className="rounded-xl border p-4 transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-semibold text-base">{campaign.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {campaign.description}
                  </p>
                </div>
                <Badge variant={campaign.isActive ? "default" : "secondary"}>
                  {campaign.isActive ? "Active" : "Paused"}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                  {campaign._count?.watchedSubreddit ?? 0} subreddits watched
                </span>
                <span>{campaign._count?.evaluations ?? 0} evaluations</span>
                <span>
                  Created{" "}
                  {formatDistanceToNow(new Date(campaign.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ResponsiveModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New campaign"
        description="Organize watch lists by campaign."
      >
        <CampaignForm
          mode="create"
          onSuccess={handleCreated}
          onCancel={() => setCreateOpen(false)}
        />
      </ResponsiveModal>
    </div>
  );
}
