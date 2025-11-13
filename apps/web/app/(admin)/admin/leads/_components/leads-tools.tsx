"use client";

import { useEffect, useMemo, useState } from "react";

import { ResponsiveModal } from "@/components/resonpsive-modal";
import { api as trpc } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
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
import { BookmarkPlus, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function LeadsTools() {
  const utils = trpc.useUtils();
  const {
    data: campaignsData,
    isLoading: campaignsLoading,
    error: campaignsError,
  } = trpc.reddit.campaigns.fetchAll.useQuery();
  const campaigns = useMemo(() => campaignsData?.items ?? [], [campaignsData]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  useEffect(() => {
    if (!campaigns.length) {
      setSelectedCampaignId("");
      return;
    }
    if (!selectedCampaignId) {
      setSelectedCampaignId(campaigns[0]!.id);
      return;
    }
    if (!campaigns.some((c) => c.id === selectedCampaignId)) {
      setSelectedCampaignId(campaigns[0]!.id);
    }
  }, [campaigns, selectedCampaignId]);
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  // API-based subreddit search (native endpoint)
  const [apiQuery, setApiQuery] = useState("");
  const [apiLimit, setApiLimit] = useState<number>(50);
  const searchApi = trpc.reddit.searchSubredditsApi.useMutation();

  // Post-based subreddit search (extract from cross-subreddit posts)
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState<number>(50);

  const search = trpc.reddit.searchSubreddits.useMutation();
  const items = useMemo(() => search.data?.items ?? [], [search.data]);
  const apiItems = useMemo(() => searchApi.data?.items ?? [], [searchApi.data]);
  const [apiSort, setApiSort] = useState<"desc" | "asc">("desc");
  const apiItemsSorted = useMemo(() => {
    const arr = [...apiItems];
    arr.sort((a: any, b: any) => {
      const av = typeof a?.subscribers === "number" ? a.subscribers : -1;
      const bv = typeof b?.subscribers === "number" ? b.subscribers : -1;
      return apiSort === "desc" ? bv - av : av - bv;
    });
    return arr;
  }, [apiItems, apiSort]);

  // Rules modal state
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesSubreddit, setRulesSubreddit] = useState<string | null>(null);
  const rules = trpc.reddit.getSubredditRules.useMutation();
  const upsertWatch = trpc.reddit.upsertWatchedSubreddit.useMutation({
    onSuccess: async (res) => {
      await utils.reddit.campaigns.fetchAll.invalidate();
      const name = res?.item?.subreddit ?? "";
      const campaignName = campaigns.find(
        (c) => c.id === res?.item?.campaignId
      )?.name;
      toast(
        name
          ? campaignName
            ? `Tracking r/${name} in ${campaignName}`
            : `Tracking r/${name}`
          : "Added to campaign"
      );
    },
    onError: (err) => {
      toast("Failed to track subreddit", { description: err.message });
    },
  });

  // Compact number formatter for subscribers (1k, 10k, 100k, 1m, ...)
  const compactFmt = useMemo(
    () =>
      new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 0,
      }),
    []
  );

  const handleTrack = (subreddit: string) => {
    if (!selectedCampaignId) {
      toast("Select a campaign", {
        description: "Create a campaign above before tracking subreddits.",
      });
      return;
    }
    const normalized = subreddit.replace(/^r\//i, "").trim();
    if (!normalized) {
      toast("Enter a subreddit name to track.");
      return;
    }
    upsertWatch.mutate({
      subreddit: normalized,
      campaignId: selectedCampaignId,
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">Save matches to campaign</div>
            <div className="text-sm text-muted-foreground">
              Newly tracked subreddits will be attached to the selected
              campaign.
            </div>
          </div>
          <Select
            value={selectedCampaignId}
            onValueChange={(value) => setSelectedCampaignId(value)}
            disabled={!campaigns.length || Boolean(campaignsError)}
          >
            <SelectTrigger className="w-full sm:w-[260px]">
              <SelectValue
                placeholder={
                  campaignsError
                    ? "Failed to load campaigns"
                    : campaignsLoading
                      ? "Loading campaigns…"
                      : "Select campaign"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                  {!campaign.isActive ? " (paused)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {campaignsError ? (
          <div className="text-sm text-destructive">
            Failed to load campaigns. {campaignsError.message}
          </div>
        ) : !campaigns.length && !campaignsLoading ? (
          <div className="text-sm text-muted-foreground">
            Create a campaign above to enable tracking.
          </div>
        ) : null}
      </div>

      {/* Subreddit Search via API */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Find Subreddits (API)</h2>
        <p className="text-sm text-muted-foreground">
          Uses Reddit's native /subreddits/search endpoint.
        </p>
        <form
          className="flex flex-wrap gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const q = apiQuery.trim();
            if (!q) return;
            searchApi.mutate({
              query: q,
              limit: Math.max(1, Math.min(200, apiLimit || 50)),
            });
          }}
        >
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm mb-1">Keyword</label>
            <Input
              placeholder="e.g. python"
              value={apiQuery}
              onChange={(e) => setApiQuery(e.target.value)}
            />
          </div>
          <div className="w-[120px]">
            <label className="block text-sm mb-1">Limit</label>
            <Input
              type="number"
              min={1}
              max={200}
              value={apiLimit}
              onChange={(e) => setApiLimit(Number(e.target.value || 50))}
            />
          </div>
          <div>
            <Button type="submit" disabled={searchApi.isPending}>
              {searchApi.isPending ? "Searching…" : "Search"}
            </Button>
          </div>
        </form>

        <div className="flex items-center justify-end py-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Sort by subscribers
            </span>
            <Select value={apiSort} onValueChange={(v) => setApiSort(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">High → Low</SelectItem>
                <SelectItem value="asc">Low → High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Subreddit</TableHead>
                <TableHead>Title/Description</TableHead>
                <TableHead>Subscribers</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchApi.isPending && !searchApi.data ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-6 text-muted-foreground"
                  >
                    Searching…
                  </TableCell>
                </TableRow>
              ) : apiItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-6 text-muted-foreground"
                  >
                    Enter a keyword and search, or no subreddits found.
                  </TableCell>
                </TableRow>
              ) : (
                apiItemsSorted.map((s) => (
                  <TableRow key={s.prefixed}>
                    <TableCell>{s.prefixed}</TableCell>
                    <TableCell className="whitespace-pre-wrap">
                      {s.title || s.description || "—"}
                    </TableCell>
                    <TableCell>
                      {typeof s.subscribers === "number"
                        ? compactFmt.format(s.subscribers).toLowerCase()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider delayDuration={0}>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={async () => {
                                  setRulesSubreddit(s.name);
                                  setRulesOpen(true);
                                  await rules.mutateAsync({
                                    subreddit: s.name,
                                  });
                                }}
                                disabled={rules.isPending}
                                aria-label="View rules"
                              >
                                {rules.isPending &&
                                rulesSubreddit === s.name ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <FileText className="size-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View rules</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleTrack(s.name)}
                                disabled={
                                  upsertWatch.isPending || !selectedCampaignId
                                }
                                aria-label="Track subreddit"
                              >
                                {(() => {
                                  const normalized = s.name.replace(
                                    /^r\//i,
                                    ""
                                  );
                                  const isSaving =
                                    upsertWatch.isPending &&
                                    upsertWatch.variables?.subreddit ===
                                      normalized &&
                                    upsertWatch.variables?.campaignId ===
                                      selectedCampaignId;
                                  return isSaving ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <BookmarkPlus className="size-4" />
                                  );
                                })()}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {selectedCampaign
                                ? `Track in ${selectedCampaign.name}`
                                : "Select a campaign first"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`https://www.reddit.com/${s.prefixed}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="Visit subreddit"
                                >
                                  <ExternalLink className="size-4" />
                                </Button>
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>Visit</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Rules Modal */}
      <ResponsiveModal
        open={rulesOpen}
        onOpenChange={(v) => setRulesOpen(v)}
        title={rulesSubreddit ? `r/${rulesSubreddit} rules` : "Subreddit rules"}
        description={
          rulesSubreddit ? "Community posting guidelines" : undefined
        }
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
                    {typeof r.priority === "number"
                      ? `${r.priority + 1}. `
                      : ""}
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
          <Button variant="outline" onClick={() => setRulesOpen(false)}>
            Close
          </Button>
        </div>
      </ResponsiveModal>
    </div>
  );
}
