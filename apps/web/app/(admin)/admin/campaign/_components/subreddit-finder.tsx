"use client";

import { millify } from "@/lib/numbers";
import { api as trpc } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
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
import {
  BookmarkPlus,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SubredditRulesModal } from "./subreddit-rules-modal";

interface SubredditFinderProps {
  campaignId: string;
}

export function SubredditFinder({ campaignId }: SubredditFinderProps) {
  const utils = trpc.useUtils();

  // Mutation for tracking subreddit (duplicate of parent logic to keep component self-contained)
  const upsertSubreddit = trpc.reddit.upsert.useMutation({
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
  const searchApi = trpc.reddit.searchApi.useMutation();
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

  const [rulesSubreddit, setRulesSubreddit] = useState<string | null>(null);

  // Similar subreddits expansion state
  const [expandedSimilarFor, setExpandedSimilarFor] = useState<string | null>(
    null
  );
  const similar = trpc.reddit.getSimilar.useMutation();

  type SubredditActionsProps = {
    rulesKey: string;
    trackKey: string;
    prefixed: string;
    reach?: number;
    showSimilar?: boolean;
    isExpanded?: boolean;
    similarKey?: string;
  };

  const SubredditActions: React.FC<SubredditActionsProps> = ({
    rulesKey,
    trackKey,
    prefixed,
    reach,
    showSimilar = false,
    isExpanded = false,
    similarKey,
  }) => {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={async () => {
                  setRulesSubreddit(rulesKey);
                  setRulesSubreddit(rulesKey);
                }}
                // disable button based on rules modal state if needed in future
                aria-label="View rules"
              >
                <FileText className="size-4" />
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
                  upsertSubreddit.mutate({
                    subreddit: trackKey,
                    campaignId,
                    reach,
                  });
                }}
                disabled={
                  upsertSubreddit.isPending &&
                  upsertSubreddit.variables?.subreddit === trackKey &&
                  upsertSubreddit.variables?.campaignId === campaignId
                }
                aria-label="Track subreddit"
              >
                {(() => {
                  const isSaving =
                    upsertSubreddit.isPending &&
                    upsertSubreddit.variables?.subreddit === trackKey &&
                    upsertSubreddit.variables?.campaignId === campaignId;
                  return isSaving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <BookmarkPlus className="size-4" />
                  );
                })()}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Track in this campaign</TooltipContent>
          </Tooltip>

          {showSimilar && similarKey ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={async () => {
                    if (isExpanded) {
                      setExpandedSimilarFor(null);
                      return;
                    }
                    setExpandedSimilarFor(similarKey);
                    await similar.mutateAsync({ subreddit: similarKey });
                  }}
                  disabled={similar.isPending}
                  aria-label="Find similar subreddits"
                >
                  {similar.isPending && isExpanded ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Find similar subreddits</TooltipContent>
            </Tooltip>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={`https://www.reddit.com/${prefixed}`}
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
    );
  };

  return (
    <>
      <div className="space-y-3">
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
            <Select value={apiSort} onValueChange={(v) => setApiSort(v as any)}>
              <SelectTrigger type="button" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">High → Low</SelectItem>
                <SelectItem value="asc">Low → High</SelectItem>
              </SelectContent>
            </Select>

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
                apiItemsSorted.map((s: any) => {
                  const normalizedName = s.name.replace(/^r\//i, "");
                  const isExpanded = expandedSimilarFor === normalizedName;

                  return (
                    <>
                      <TableRow key={s.prefixed}>
                        <TableCell>{s.prefixed}</TableCell>
                        <TableCell className="whitespace-pre-wrap">
                          {s.title || s.description || "—"}
                        </TableCell>
                        <TableCell>
                          {typeof s.subscribers === "number"
                            ? millify(s.subscribers)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <SubredditActions
                            rulesKey={normalizedName}
                            trackKey={normalizedName}
                            prefixed={s.prefixed}
                            reach={s.subscribers}
                            showSimilar
                            isExpanded={isExpanded}
                            similarKey={normalizedName}
                          />
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <React.Fragment key={`${s.prefixed}-similar`}>
                          {similar.isPending && !similar.data ? (
                            <div className="py-3 text-sm text-muted-foreground">
                              Loading similar subreddits…
                            </div>
                          ) : similar.data?.items?.length ? (
                            <>
                              <TableRow>
                                <TableCell colSpan={4} className="bg-muted/40">
                                  <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">
                                      Similar subreddits to r/{normalizedName}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {similar.data.items.map((child: any) => {
                                const childNormalized = child.name.replace(
                                  /^r\//i,
                                  ""
                                );

                                return (
                                  <TableRow
                                    key={`${normalizedName}-${child.prefixed}`}
                                    className="bg-muted"
                                  >
                                    <TableCell>{child.prefixed}</TableCell>
                                    <TableCell className="whitespace-pre-wrap">
                                      {child.title || child.description || "—"}
                                    </TableCell>
                                    <TableCell>
                                      {typeof child.subscribers === "number"
                                        ? millify(child.subscribers)
                                        : "—"}
                                    </TableCell>
                                    <TableCell>
                                      <SubredditActions
                                        rulesKey={childNormalized}
                                        trackKey={childNormalized}
                                        prefixed={child.prefixed}
                                        reach={child.subscribers}
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </>
                          ) : (
                            <TableRow className="py-3 text-sm text-muted-foreground">
                              <TableCell colSpan={5}>
                                No similar subreddits found.
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <SubredditRulesModal subreddit={rulesSubreddit} />
    </>
  );
}
