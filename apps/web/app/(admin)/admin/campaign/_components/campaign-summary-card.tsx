"use client";

import { ResponsiveModal } from "@/components/resonpsive-modal";
import { useAreYouSure } from "@/hooks/use-are-you-sure";
import { api } from "@/trpc/react";
import { Campaign } from "@workspace/database";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { EditIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const { AreYouSure, setShowAreYouSure } = useAreYouSure();
  const router = useRouter();
  const utils = api.useUtils();
  const toggleMutation = api.reddit.campaigns.upsert.useMutation({
    onSuccess: async () => {
      await utils.reddit.campaigns.fetch.invalidate();
      await utils.reddit.campaigns.fetchAll.invalidate();
    },
  });
  const deleteMutation = api.reddit.campaigns.delete.useMutation({
    onSuccess: async () => {
      await utils.reddit.campaigns.fetch.invalidate();
      await utils.reddit.campaigns.fetchAll.invalidate();
      router.push("/admin/leads");
    },
  });
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

  const handleConfirmDelete = async () => {
    deleteMutation.mutate({ id: campaign.id });
  };

  return (
    <>
      <Card className="p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 w-full">
          <div className="space-y-2 flex flex-col w-full">
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

              <div className="ml-auto flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Edit campaign"
                      onClick={() => setEditOpen(true)}
                    >
                      <EditIcon className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit campaign</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Delete campaign"
                      onClick={() => setShowAreYouSure(true)}
                    >
                      <Trash2Icon className="w-4 h-4 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete campaign</TooltipContent>
                </Tooltip>
              </div>
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
      <AreYouSure
        title="Delete campaign?"
        description="This will permanently delete this campaign. This action cannot be undone."
        onConfirm={handleConfirmDelete}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}
