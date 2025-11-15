"use client";

import { ResponsiveModal } from "@/components/resonpsive-modal";
import { api as trpc } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import { useEffect, useState } from "react";

interface SubredditRulesModalProps {
  subreddit: string | null;
}

export function SubredditRulesModal({ subreddit }: SubredditRulesModalProps) {
  const [open, setOpen] = useState(false);
  const [currentSubreddit, setCurrentSubreddit] = useState<string | null>(null);

  const rules = trpc.reddit.getRules.useMutation();

  useEffect(() => {
    if (subreddit && subreddit !== currentSubreddit) {
      setCurrentSubreddit(subreddit);
      setOpen(true);
      rules.mutate({ subreddit });
    }
  }, [subreddit, currentSubreddit, rules]);

  const title = currentSubreddit
    ? `r/${currentSubreddit} rules`
    : "Subreddit rules";
  const description = currentSubreddit
    ? "Community posting guidelines"
    : undefined;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => setOpen(v)}
      title={title}
      description={description}
    >
      {rules.isPending && !rules.data ? (
        <div className="text-sm text-muted-foreground">Loading rules…</div>
      ) : rules.data?.items?.length ? (
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          {rules.data.items
            .slice()
            .sort((a: any, b: any) => (a.priority ?? 0) - (b.priority ?? 0))
            .map((r: any, idx: number) => (
              <div
                key={`${r.shortName}-${idx}`}
                className="rounded-md border p-3"
              >
                <div className="font-medium">
                  {typeof r.priority === "number" ? `${r.priority + 1}. ` : ""}
                  {r.shortName || "Untitled rule"}
                </div>
                {r.description ? (
                  <div className="mt-1 text-sm whitespace-pre-wrap">
                    {r.description}
                  </div>
                ) : null}
                {r.violationReason ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Violation: {r.violationReason}
                  </div>
                ) : null}
              </div>
            ))}
          {rules.data.siteRules?.length ? (
            <div className="pt-2 text-xs text-muted-foreground">
              Site-wide rules may also apply.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No rules found.</div>
      )}
      <div className="mt-4">
        <Button variant="outline" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </ResponsiveModal>
  );
}
