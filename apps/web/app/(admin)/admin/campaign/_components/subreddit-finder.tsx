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
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
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
  const [manualSubreddit, setManualSubreddit] = useState("");

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
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <form
            className="flex flex-col gap-2 md:flex-row md:items-end md:gap-2 md:w-[40%]"
            onSubmit={(e) => {
              e.preventDefault();
              const normalized = manualSubreddit.replace(/^r\//i, "").trim();
              if (!normalized) {
                toast.error("Enter a subreddit name");
                return;
              }
              upsertSubreddit.mutate({
                subreddit: normalized,
                campaignId,
              });
            }}
          >
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="subreddit-manual" className="sr-only">
                Add subreddit directly
              </label>
              <Input
                id="subreddit-manual"
                placeholder="Add subreddit (e.g. r/python)"
                value={manualSubreddit}
                onChange={(e) => setManualSubreddit(e.target.value)}
              />
            </div>
            <div className="flex md:h-[40px] md:items-end">
              <Button
                type="submit"
                variant="outline"
                disabled={upsertSubreddit.isPending}
              >
                {upsertSubreddit.isPending ? "Adding…" : "Add"}
              </Button>
            </div>
          </form>

          <Form {...form}>
            <form
              className="flex flex-col gap-2 md:flex-row md:flex-1 md:items-end md:gap-2"
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
                  <FormItem className="flex-1 min-w-[200px]">
                    <FormLabel className="sr-only">Keyword</FormLabel>
                    <FormControl>
                      <Input placeholder="Search by keyword" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex md:h-[40px] md:items-end gap-2">
                <Button
                  type="submit"
                  disabled={searchApi.isPending || !form.formState.isValid}
                >
                  {searchApi.isPending ? "Searching…" : "Search"}
                </Button>

                {(form.watch("keyword") || apiItemsSorted.length > 0) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    onClick={() => {
                      form.reset({
                        keyword: "",
                        limit: form.getValues("limit") ?? 50,
                      });
                      setExpandedSimilarFor(null);
                      searchApi.reset();
                      similar.reset();
                    }}
                    disabled={searchApi.isPending}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>

        {apiItemsSorted.length > 0 && (
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
                                  <TableCell
                                    colSpan={4}
                                    className="bg-muted/40"
                                  >
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
                                        {child.title ||
                                          child.description ||
                                          "—"}
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
        )}
      </div>

      <SubredditRulesModal subreddit={rulesSubreddit} />
    </>
  );
}
