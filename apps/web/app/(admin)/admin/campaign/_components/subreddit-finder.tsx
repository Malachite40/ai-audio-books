"use client";

import { ResponsiveModal } from "@/components/resonpsive-modal";
import { api as trpc } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
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
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface SubredditFinderProps {
  campaignId: string;
}

export function SubredditFinder({ campaignId }: SubredditFinderProps) {
  const utils = trpc.useUtils();

  // Mutation for tracking subreddit (duplicate of parent logic to keep component self-contained)
  const upsertSubreddit = trpc.reddit.upsertWatchedSubreddit.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.reddit.campaigns.fetch.invalidate({ id: campaignId }),
        utils.reddit.campaigns.fetchAll.invalidate(),
      ]);
      toast.success("Subreddit added");
    },
    onError: (err) => {
      toast.error("Failed to add subreddit", { description: err.message });
    },
  });

  // Finder tool (API search) form
  const SearchSchema = z.object({
    keyword: z.string().trim().min(1, "Enter a keyword to search"),
    limit: z.coerce
      .number()
      .int("Must be a whole number")
      .min(1, "Min 1")
      .max(200, "Max 200"),
  });
  type SearchValues = z.infer<typeof SearchSchema>;

  const form = useForm<SearchValues>({
    resolver: zodResolver(SearchSchema),
    defaultValues: { keyword: "", limit: 50 },
    mode: "onChange",
  });
  const [apiSort, setApiSort] = useState<"desc" | "asc">("desc");
  const searchApi = trpc.reddit.searchSubredditsApi.useMutation();
  const apiItems = useMemo(() => searchApi.data?.items ?? [], [searchApi.data]);
  const apiItemsSorted = useMemo(() => {
    const arr = [...apiItems];
    arr.sort((a: any, b: any) => {
      const av = typeof a?.subscribers === "number" ? a.subscribers : -1;
      const bv = typeof b?.subscribers === "number" ? b.subscribers : -1;
      return apiSort === "desc" ? bv - av : av - bv;
    });
    return arr;
  }, [apiItems, apiSort]);

  // Rules modal
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesSubreddit, setRulesSubreddit] = useState<string | null>(null);
  const rules = trpc.reddit.getSubredditRules.useMutation();

  // Compact number formatter for subscribers
  const compactFmt = useMemo(
    () =>
      new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 0,
      }),
    []
  );

  return (
    <>
      <Card className="p-6 space-y-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Find and track subreddits</h3>
          <p className="text-sm text-muted-foreground">
            Uses Reddit's native search. Track results directly into this
            campaign.
          </p>
        </div>
        <Form {...form}>
          <form
            className="flex flex-wrap gap-2 items-end"
            onSubmit={form.handleSubmit((values) => {
              const query = values.keyword.trim();
              if (!query) return; // guarded by schema but double-protect
              searchApi.mutate({
                query,
                limit: values.limit,
              });
            })}
          >
            <FormField
              control={form.control}
              name="keyword"
              render={({ field }) => (
                <FormItem className="flex-1 min-w-[220px]">
                  <FormLabel className="text-sm">Keyword</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. python" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="limit"
              render={({ field }) => (
                <FormItem className="w-[120px]">
                  <FormLabel className="text-sm">Limit</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      inputMode="numeric"
                      {...field}
                      value={field.value ?? 50}
                      onChange={(e) => {
                        // Allow empty string temporarily for user typing
                        const val = e.target.value;
                        if (val === "") field.onChange(val);
                        else field.onChange(Number(val));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="h-[58px] flex items-end pb-[2px]">
              <Button
                type="submit"
                disabled={searchApi.isPending || !form.formState.isValid}
              >
                {searchApi.isPending ? "Searching…" : "Search"}
              </Button>
            </div>
          </form>
        </Form>

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
                <TableHead className="w-[160px]">Actions</TableHead>
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
                apiItemsSorted.map((s: any) => (
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
                                onClick={() => {
                                  const normalized = s.name.replace(
                                    /^r\//i,
                                    ""
                                  );
                                  upsertSubreddit.mutate({
                                    subreddit: normalized,
                                    campaignId,
                                  });
                                }}
                                disabled={
                                  upsertSubreddit.isPending &&
                                  upsertSubreddit.variables?.subreddit ===
                                    s.name.replace(/^r\//i, "") &&
                                  upsertSubreddit.variables?.campaignId ===
                                    campaignId
                                }
                                aria-label="Track subreddit"
                              >
                                {(() => {
                                  const normalized = s.name.replace(
                                    /^r\//i,
                                    ""
                                  );
                                  const isSaving =
                                    upsertSubreddit.isPending &&
                                    upsertSubreddit.variables?.subreddit ===
                                      normalized &&
                                    upsertSubreddit.variables?.campaignId ===
                                      campaignId;
                                  return isSaving ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <BookmarkPlus className="size-4" />
                                  );
                                })()}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Track in this campaign
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
      </Card>

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
    </>
  );
}
