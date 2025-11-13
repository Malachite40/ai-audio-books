"use client";

import { ResponsiveModal } from "@/components/resonpsive-modal";
import { api } from "@/trpc/react";
import { Campaign } from "@workspace/database";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { EditIcon } from "lucide-react";
import { useState } from "react";
import { CampaignForm } from "./campaign-form";

type CampaignSummaryCardProps = {
  campaign: Campaign;
  watchedSubredditsCount?: number;
  evaluationsCount?: number;
  onUpdated?: () => Promise<void> | void;
};

export function CampaignSummaryCard({
  campaign,
  watchedSubredditsCount,
  evaluationsCount,
  onUpdated,
}: CampaignSummaryCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const toggleMutation = api.reddit.campaigns.upsert.useMutation({
    onSuccess: async () => {
      await utils.reddit.campaigns.fetch.invalidate();
      await utils.reddit.campaigns.fetchAll.invalidate();
    },
  });
  const utils = api.useUtils();
  const handleUpdated = async () => {
    // Invalidate relevant queries after edit
    await utils.reddit.campaigns.fetch.invalidate();
    await utils.reddit.campaigns.fetchAll.invalidate();
    onUpdated?.();
    setEditOpen(false);
  };

  const handleToggleActive = () => {
    if (toggleMutation.isPending) return;
    // description must be at least 1 char per zod schema; fall back to '-'
    const description = (campaign.description?.trim() || "-").slice(0, 1000);
    toggleMutation.mutate({
      id: campaign.id,
      name: campaign.name,
      description,
      isActive: !campaign.isActive,
    });
  };

  return (
    <>
      <Card className="p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex gap-3 flex-wrap">
              <div className="flex flex-col gap-2">
                {/*  Toggle Active & Edit Button */}
                <h2 className="text-2xl font-semibold tracking-tight flex gap-2 items-center">
                  <span>{campaign.name}</span>
                  <Badge
                    variant={campaign.isActive ? "default" : "secondary"}
                    onClick={handleToggleActive}
                    role="button"
                    className={
                      toggleMutation.isPending
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                    }
                    title={
                      campaign.isActive
                        ? "Click to pause campaign"
                        : "Click to activate campaign"
                    }
                  >
                    {toggleMutation.isPending
                      ? "Loading..."
                      : campaign.isActive
                        ? "Active"
                        : "Paused"}
                  </Badge>
                </h2>

                <div className="flex gap-2">
                  <Badge variant="outline" className="font-normal">
                    {watchedSubredditsCount ?? 0} subreddits
                  </Badge>
                  <Badge variant="outline" className="font-normal">
                    {evaluationsCount ?? 0} scanned posts
                  </Badge>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="ml-auto"
              >
                <EditIcon />
              </Button>
            </div>
            {campaign.description ? (
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {campaign.description}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No description.
              </p>
            )}
          </div>
        </div>
      </Card>
      <ResponsiveModal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit campaign"
        description="Update campaign details."
      >
        <CampaignForm
          mode="edit"
          campaign={campaign}
          onSuccess={handleUpdated}
          onCancel={() => setEditOpen(false)}
        />
      </ResponsiveModal>
    </>
  );
}
