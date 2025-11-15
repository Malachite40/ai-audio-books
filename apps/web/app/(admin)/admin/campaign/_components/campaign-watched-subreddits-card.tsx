"use client";

import { useAreYouSure } from "@/hooks/use-are-you-sure";
import { millify } from "@/lib/numbers";
import { api as trpc } from "@/trpc/react";
import { WatchedSubreddit } from "@workspace/database";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
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
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface CampaignWatchedSubredditsCardProps {
  campaignId: string;
  watchedSubreddits: WatchedSubreddit[];
}

type SortOption = "name-asc" | "added-desc" | "added-asc";

export function CampaignWatchedSubredditsCard({
  campaignId,
  watchedSubreddits,
}: CampaignWatchedSubredditsCardProps) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortOption>("added-desc");

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

  const filteredSortedRows = useMemo(() => {
    const term = filter.trim().toLowerCase();
    let items = watchedSubreddits;
    if (term)
      items = items.filter((w) => w.subreddit.toLowerCase().includes(term));
    const copy = [...items];
    switch (sort) {
      case "name-asc":
        copy.sort((a, b) => a.subreddit.localeCompare(b.subreddit));
        break;
      case "added-asc":
        copy.sort(
          (a, b) =>
            new Date(a.createdAt ?? 0).getTime() -
            new Date(b.createdAt ?? 0).getTime()
        );
        break;
      case "added-desc":
      default:
        copy.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
        );
        break;
    }
    return copy;
  }, [watchedSubreddits, filter, sort]);

  return (
    <Card className="p-0 overflow-hidden">
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
      <div className="flex items-center justify-between gap-2 p-4 border-b">
        <div className="flex items-center gap-2 max-w-md w-full">
          <Input
            placeholder="Filter by subreddit"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => scanWatchList.mutate({ campaignId })}
                  disabled={scanWatchList.isPending}
                  aria-label="Scan all watched subreddits"
                >
                  {scanWatchList.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Scan all watched subreddits</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="text-sm text-muted-foreground">Sort</div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="added-desc">Newest added</SelectItem>
              <SelectItem value="added-asc">Oldest added</SelectItem>
              <SelectItem value="name-asc">Name A → Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subreddit</TableHead>
            <TableHead className="w-48">Added</TableHead>
            <TableHead className="w-48">Reach</TableHead>
            <TableHead className="w-48">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSortedRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
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
              return (
                <TableRow key={watch.subreddit}>
                  <TableCell>r/{watch.subreddit}</TableCell>
                  <TableCell>
                    {createdAt
                      ? formatDistanceToNow(createdAt, { addSuffix: true })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {watch.reach !== null && watch.reach !== undefined
                      ? millify(watch.reach)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
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
    </Card>
  );
}
