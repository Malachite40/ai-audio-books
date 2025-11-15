"use client";

import { ResponsiveModal } from "@/components/resonpsive-modal";
import { api } from "@/trpc/react";
import type { RedditPost, RedditPostEvaluation } from "@workspace/database";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type CampaignExampleModalProps = {
  open: boolean;
  evaluation: RedditPostEvaluation;
  redditPost: RedditPost;
  onClose: () => void;
};

export function CampaignExampleModal({
  open,
  evaluation,
  redditPost,
  onClose,
}: CampaignExampleModalProps) {
  const utils = api.useUtils();
  const [content, setContent] = useState(evaluation.exampleMessage ?? "");
  const [score, setScore] = useState<number>(evaluation.score ?? 0);

  const bookmarkEvaluation = api.reddit.evaluations.bookmark.useMutation({
    onSuccess: () => {
      utils.reddit.evaluations.fetchAll.invalidate();
      onClose();
    },
  });

  const handleSave = () => {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      toast.error("Please add some content before saving.");
      return;
    }

    bookmarkEvaluation.mutate({
      evaluationId: evaluation.id,
      bookmarked: true,
      score,
      exampleMessage: trimmed,
    });
  };

  const isSaveDisabled =
    content.trim().length === 0 || bookmarkEvaluation.isPending;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      title="Save example evaluation"
      description={redditPost.title}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Example score (1-100)</label>
          <Input
            type="number"
            min={1}
            max={100}
            placeholder="1-100"
            value={score > 0 ? score : ""}
            onChange={(event) => {
              const value = Number(event.target.value);
              const clamped = Math.max(1, Math.min(100, value));
              setScore(clamped);
            }}
          />
        </div>

        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Describe the curated answer or example response."
          rows={7}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Existing example message will be overwritten.</span>
          <span>{content.trim().length} characters</span>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>
            {bookmarkEvaluation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
