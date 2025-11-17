"use client";

import { useAreYouSure } from "@/hooks/use-are-you-sure";
import { millify } from "@/lib/numbers";
import { api as trpc } from "@/trpc/react";
import { WatchedSubreddit } from "@workspace/database";
import { Button } from "@workspace/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import {
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Trash2,
  ArrowDownAZ,
  ArrowUpDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface CampaignWatchedSubredditsCardProps {
  campaignId: string;
  watchedSubreddits: WatchedSubreddit[];
  scoreShares?: {
    subreddit: string | null;
    total: number;
    above: number;
    percentage: number;
    threshold: number;
  }[];
}

type SortOption = "name-asc" | "high-score-desc" | "high-score-asc";

export function CampaignWatchedSubredditsCard({
  campaignId,
  watchedSubreddits,
  scoreShares,
}: CampaignWatchedSubredditsCardProps) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortOption>("high-score-desc");

  const campaignQuery = trpc.reddit.campaigns.fetch.useQuery({
    id: campaignId,
  });

  const {
    AreYouSure,
    setShowAreYouSure,
    object: subredditToDelete,
    setObject: setSubredditToDelete,
  } = useAreYouSure<string>();

  // Mutations scoped here so parent stays slim
  const utils = trpc.useUtils();
  const deleteSubreddit = trpc.reddit.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.reddit.campaigns.fetch.invalidate({ id: campaignId }),
        utils.reddit.campaigns.fetchAll.invalidate(),
      ]);
      toast.success("Subreddit removed");
    },
    onError: (err) =>
      toast.error("Failed to remove subreddit", { description: err.message }),
  });
  const scanSubreddit = trpc.reddit.adminQueueScan.useMutation({
    onSuccess: () => toast.success("Scan queued"),
    onError: (err) =>
      toast.error("Failed to queue scan", { description: err.message }),
  });
  const scanWatchList = trpc.reddit.campaigns.adminScan.useMutation({
    onSuccess: () => toast.success("Queued scans for watched subreddits"),
    onError: (err) =>
      toast.error("Failed to queue scans", { description: err.message }),
  });
  const backfillSubreddit = trpc.reddit.adminQueueBackfill30Days.useMutation({
    onSuccess: () => toast.success("Backfill for last 30 days queued"),
    onError: (err) =>
      toast.error("Failed to queue backfill", { description: err.message }),
  });

  const filteredSortedRows = useMemo(() => {
    const term = filter.trim().toLowerCase();
    let items = watchedSubreddits;
    if (term)
      items = items.filter((w) => w.subreddit.toLowerCase().includes(term));
    const scoresBySubreddit = new Map<string, number>();
    for (const s of scoreShares ?? []) {
      if (!s.subreddit) continue;
      scoresBySubreddit.set(s.subreddit, s.percentage);
    }

    const copy = [...items];
    switch (sort) {
      case "high-score-desc":
        // Default: sort by high-score percentage desc, then newest created
        copy.sort((a, b) => {
          const aPct = scoresBySubreddit.get(a.subreddit) ?? -1;
          const bPct = scoresBySubreddit.get(b.subreddit) ?? -1;
          if (aPct !== bPct) return bPct - aPct;
          return (
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
          );
        });
        break;
      case "high-score-asc":
        copy.sort((a, b) => {
          const aPct = scoresBySubreddit.get(a.subreddit) ?? -1;
          const bPct = scoresBySubreddit.get(b.subreddit) ?? -1;
          if (aPct !== bPct) return aPct - bPct;
          return (
            new Date(a.createdAt ?? 0).getTime() -
            new Date(b.createdAt ?? 0).getTime()
          );
        });
        break;
      case "name-asc":
        copy.sort((a, b) => a.subreddit.localeCompare(b.subreddit));
        break;
      default:
        // Fallback to high-score desc
        copy.sort((a, b) => {
          const aPct = scoresBySubreddit.get(a.subreddit) ?? -1;
          const bPct = scoresBySubreddit.get(b.subreddit) ?? -1;
          if (aPct !== bPct) return bPct - aPct;
          return (
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
          );
        });
        break;
    }
    return copy;
  }, [watchedSubreddits, filter, sort, scoreShares]);

  return (
    <div className="p-0 overflow-hidden rounded-xl border">
      <AreYouSure
        title={
          subredditToDelete ? `Remove r/${subredditToDelete}?` : "Are you sure?"
        }
        description="This will stop tracking this subreddit for this campaign."
        isPending={deleteSubreddit.isPending}
        onConfirm={async () => {
          if (!subredditToDelete) return;
          await deleteSubreddit.mutateAsync({
            subreddit: subredditToDelete,
            campaignId,
          });
        }}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <div className="flex items-center gap-1">
                <span>Subreddit</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0"
                  onClick={() => setSort("name-asc")}
                  aria-label="Sort by subreddit A to Z"
                >
                  <ArrowDownAZ
                    className={`h-4 w-4 ${
                      sort === "name-asc"
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  />
                </Button>
              </div>
            </TableHead>
            <TableHead className="w-64 text-end">
              <div className="flex items-center justify-end gap-2">
                <span>{`Score ≥ ${(function () {
              if (campaignQuery.isPending) return "-";
              return campaignQuery.data?.campaign?.autoArchiveScore ?? "75";
            })()}`}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0"
                  onClick={() =>
                    setSort((prev) =>
                      prev === "high-score-desc"
                        ? "high-score-asc"
                        : "high-score-desc"
                    )
                  }
                  aria-label={
                    sort === "high-score-asc"
                      ? "Sort by score descending"
                      : "Sort by score ascending"
                  }
                >
                  <ArrowUpDown
                    className={`h-4 w-4 ${
                      sort === "high-score-desc" || sort === "high-score-asc"
                        ? "text-foreground"
                        : "text-muted-foreground"
                    } ${sort === "high-score-asc" ? "rotate-180" : ""}`}
                  />
                </Button>
              </div>
            </TableHead>
            <TableHead className="w-48">Reach</TableHead>
            <TableHead className="w-48">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSortedRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center py-6 text-muted-foreground"
              >
                {watchedSubreddits.length === 0
                  ? "No subreddits tracked yet. Use the finder below to get started."
                  : "No matches for your filter."}
              </TableCell>
            </TableRow>
          ) : (
            filteredSortedRows.map((watch) => {
              const createdAt = watch.createdAt
                ? new Date(watch.createdAt)
                : undefined;
              const isScanning =
                scanSubreddit.isPending &&
                scanSubreddit.variables?.subreddit === watch.subreddit;
              const isDeleting =
                deleteSubreddit.isPending &&
                deleteSubreddit.variables?.subreddit === watch.subreddit;
              const isBackfilling =
                backfillSubreddit.isPending &&
                backfillSubreddit.variables?.subreddit === watch.subreddit;
              return (
                <TableRow key={watch.subreddit}>
                  <TableCell>r/{watch.subreddit}</TableCell>
                  <TableCell className="text-end">
                    <SubredditHighScoreShare
                      campaignId={campaignId}
                      subreddit={watch.subreddit}
                    />
                  </TableCell>
                  <TableCell>
                    {watch.reach !== null && watch.reach !== undefined
                      ? millify(watch.reach)
                      : "—"}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                backfillSubreddit.mutate({
                                  subreddit: watch.subreddit,
                                })
                              }
                              disabled={backfillSubreddit.isPending}
                              aria-label={`Backfill last 30 days for r/${watch.subreddit}`}
                            >
                              {isBackfilling ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <History className="size-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Backfill last 30 days</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          scanSubreddit.mutate({
                            subreddit: watch.subreddit,
                          })
                        }
                        disabled={scanSubreddit.isPending}
                        aria-label={`Scan r/${watch.subreddit}`}
                      >
                        {isScanning ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                      </Button>
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={`https://www.reddit.com/r/${watch.subreddit}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Visit r/${watch.subreddit}`}
                              >
                                <ExternalLink className="size-4" />
                              </Button>
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>Visit</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => {
                          setSubredditToDelete(watch.subreddit);
                          setShowAreYouSure(true);
                        }}
                        disabled={deleteSubreddit.isPending}
                        aria-label={`Remove r/${watch.subreddit}`}
                      >
                        {isDeleting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SubredditHighScoreShare(props: {
  campaignId: string;
  subreddit: string;
}) {
  const { campaignId, subreddit } = props;

  const { data, isLoading, error } =
    trpc.reddit.evaluations.getHighScoreShare.useQuery({
      campaignId,
      subreddit,
      days: 30,
    });

  if (isLoading) {
    return <span className="text-xs text-muted-foreground">Loading…</span>;
  }

  if (error) {
    return (
      <span className="text-xs text-destructive" title={error.message}>
        Error
      </span>
    );
  }

  if (!data || data.total === 0) {
    return (
      <span className="text-xs text-muted-foreground">No scored posts</span>
    );
  }

  const pct = data.percentage;
  let colorClass = "text-muted-foreground";
  if (pct >= 15) colorClass = "text-emerald-600";
  else if (pct >= 7) colorClass = "text-amber-600";
  else colorClass = "text-destructive";

  return (
    <span className={`text-xs ${colorClass}`}>
      ({data.above}/{data.total}) {pct.toFixed(1)}%
    </span>
  );
}
