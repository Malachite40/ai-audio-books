"use client";

import React, { useEffect, useMemo, useState } from "react";

import { PaginationBar } from "@/components/pagination-bar";
import { ResponsiveModal } from "@/components/resonpsive-modal";
import { api } from "@/trpc/react";
import { Badge } from "@workspace/ui/components/badge";
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
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  ArchiveIcon,
  BookmarkIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2,
  MessageCircle,
  PlusIcon,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";

const SORT_OPTIONS = [
  { value: "createdAt_desc", label: "Newest first" },
  { value: "createdAt_asc", label: "Oldest first" },
  { value: "score_desc", label: "Highest score" },
  { value: "score_asc", label: "Lowest score" },
] as const;
type EvaluationSortValue = (typeof SORT_OPTIONS)[number]["value"];
const DEFAULT_EVALUATION_SORT: EvaluationSortValue = "score_desc";
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;
type EvaluationStatusValue = (typeof STATUS_OPTIONS)[number]["value"];
const DEFAULT_EVALUATION_STATUS: EvaluationStatusValue = "active";
const EVALUATION_PAGE_SIZE = 25;

export function CampaignEvaluationList({ campaignId }: { campaignId: string }) {
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("75");
  const [sortValue, setSortValue] = useState<EvaluationSortValue>(
    DEFAULT_EVALUATION_SORT
  );
  const [statusValue, setStatusValue] = useState<EvaluationStatusValue>(
    DEFAULT_EVALUATION_STATUS
  );
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [exampleModalOpen, setExampleModalOpen] = useState(false);
  const [exampleModalContent, setExampleModalContent] = useState("");
  const [selectedEvaluation, setSelectedEvaluation] = useState<{
    id: string;
    exampleMessage?: string | null;
    redditPost?: {
      title?: string | null;
      selfText?: string | null;
    };
  } | null>(null);
  const utils = api.useUtils();

  const closeExampleModal = () => {
    setExampleModalOpen(false);
    setSelectedEvaluation(null);
    setExampleModalContent("");
  };

  const updateRating = api.reddit.updateRating.useMutation({
    onSuccess: () => {
      void utils.reddit.evaluations.fetchAll.invalidate();
    },
  });

  const archiveEvaluation = api.reddit.evaluations.archive.useMutation({
    onSuccess: () => {
      void utils.reddit.evaluations.fetchAll.invalidate();
    },
  });

  const saveExampleEvaluation =
    api.reddit.exampleEvaluations.upsert.useMutation({
      onSuccess: () => {
        toast.success("Example evaluation saved");
        void utils.reddit.evaluations.fetchAll.invalidate();
        closeExampleModal();
      },
      onError: (error) => {
        toast.error("Failed to save example", {
          description: error.message,
        });
      },
    });

  const deleteExampleEvaluation =
    api.reddit.exampleEvaluations.delete.useMutation({
      onSuccess: () => {
        void utils.reddit.evaluations.fetchAll.invalidate();
      },
    });

  const handleExampleSave = () => {
    if (!selectedEvaluation) return;
    const trimmed = exampleModalContent.trim();
    if (trimmed.length === 0) {
      toast.error("Please add some content before saving.");
      return;
    }

    saveExampleEvaluation.mutate({
      redditPostEvaluationId: selectedEvaluation.id,
      modifiedContent: trimmed,
    });
  };

  const openExampleModal = (evaluation: {
    id: string;
    exampleMessage?: string | null;
    redditPost?: {
      selfText?: string | null;
      title?: string | null;
    };
  }) => {
    const defaultContent =
      evaluation.exampleMessage ??
      evaluation.redditPost?.selfText ??
      evaluation.redditPost?.title ??
      "";
    setSelectedEvaluation(evaluation);
    setExampleModalContent(defaultContent);
    setExampleModalOpen(true);
  };

  const isExampleSaveDisabled =
    exampleModalContent.trim().length === 0 || saveExampleEvaluation.isPending;

  const exampleModalDescription = selectedEvaluation?.redditPost?.title
    ? `Post: ${selectedEvaluation.redditPost?.title}`
    : undefined;

  const parsedMinScore = useMemo(() => {
    if (minScore.trim() === "") return undefined;
    const numeric = Number(minScore);
    if (Number.isNaN(numeric)) return undefined;
    return Math.max(1, Math.min(100, Math.round(numeric)));
  }, [minScore]);

  useEffect(() => {
    setPage(1);
  }, [campaignId, search, parsedMinScore, sortValue, statusValue]);

  const sortParts = sortValue.split("_") as [
    "createdAt" | "score",
    "asc" | "desc",
  ];

  const { data, isFetching, error, refetch } =
    api.reddit.evaluations.fetchAll.useQuery({
      campaignId,
      page,
      pageSize: EVALUATION_PAGE_SIZE,
      search: search.trim() || undefined,
      minScore: parsedMinScore,
      archived:
        statusValue === "archived"
          ? true
          : statusValue === "active"
            ? false
            : undefined,
      sort: {
        field: sortParts[0],
        dir: sortParts[1],
      },
    });

  const items = data?.items ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / EVALUATION_PAGE_SIZE)
  );

  const hasFilters =
    Boolean(search.trim()) ||
    parsedMinScore != null ||
    sortValue !== DEFAULT_EVALUATION_SORT ||
    statusValue !== DEFAULT_EVALUATION_STATUS;

  const handleResetFilters = () => {
    setSearch("");
    setMinScore("");
    setSortValue(DEFAULT_EVALUATION_SORT);
    setStatusValue(DEFAULT_EVALUATION_STATUS);
  };

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getScoreBadge = (score: number) => {
    // Green if > 75, Blue if > 60, Red otherwise
    if (score > 75) {
      return (
        <Badge
          variant="outline"
          className="border-0 bg-green-500/15 text-green-700 hover:bg-green-500/25 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
        >
          {score}
        </Badge>
      );
    }
    if (score > 60) {
      return (
        <Badge
          variant="outline"
          className="border-0 bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
        >
          {score}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-0 bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
      >
        {score}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 w-full">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-sm mb-1">Search</label>
          <Input
            placeholder="Title or author"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Min score</label>
          <Input
            type="number"
            min={1}
            max={100}
            placeholder="1-100"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Sort</label>
          <Select
            value={sortValue}
            onValueChange={(value) =>
              setSortValue(value as EvaluationSortValue)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort evaluations" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm mb-1">Status</label>
          <Select
            value={statusValue}
            onValueChange={(value) =>
              setStatusValue(value as EvaluationStatusValue)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Refresh evaluations"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh evaluations</TooltipContent>
          </Tooltip>
          {hasFilters && (
            <Button variant="ghost" onClick={handleResetFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <Card className="p-6 flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Failed to load evaluations.</div>
            <div className="text-sm text-muted-foreground">
              {error.message || "Unknown error"}
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      ) : isFetching && !data ? (
        <Card className="p-6 text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Loading evaluations…
        </Card>
      ) : (
        <div className="overflow-auto rounded-xl border">
          <Table className="">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Created</TableHead>
                <TableHead className="w-20">Score</TableHead>
                <TableHead className="w-44">Subreddit</TableHead>
                <TableHead className="w-20">Score</TableHead>
                <TableHead className="w-20"></TableHead>
                <TableHead>Title</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No evaluations yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((evaluation) => {
                  const isOpen = expanded.has(evaluation.id);
                  return (
                    <React.Fragment key={evaluation.id}>
                      <TableRow
                        onClick={() => toggleRow(evaluation.id)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/50",
                          evaluation.rating === "POSITIVE" &&
                            "bg-emerald-500/5 hover:bg-emerald-500/20",
                          evaluation.rating === "NEGATIVE" &&
                            "bg-rose-500/5 hover:bg-rose-500/20",
                          isOpen && !evaluation.rating && "bg-muted/40"
                        )}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleRow(evaluation.id);
                          }
                        }}
                        aria-expanded={isOpen}
                      >
                        <TableCell className="text-sm items-center justify-between flex gap-1">
                          {formatDistanceToNow(evaluation.createdAt, {
                            addSuffix: true,
                          }).replace("about ", "")}
                          {evaluation.exampleEvaluation && (
                            <BookmarkIcon className="size-4 text-muted-foreground " />
                          )}
                        </TableCell>
                        <TableCell>{getScoreBadge(evaluation.score)}</TableCell>
                        <TableCell>
                          {evaluation.redditPost?.subreddit ? (
                            <a
                              href={`https://reddit.com/r/${evaluation.redditPost.subreddit}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-block"
                            >
                              <Badge
                                variant="outline"
                                className="border-0 bg-slate-500/10 text-slate-700 dark:text-slate-300 dark:bg-slate-500/10"
                              >
                                r/{evaluation.redditPost.subreddit}
                              </Badge>
                            </a>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-0 bg-slate-500/10 text-slate-700 dark:text-slate-300 dark:bg-slate-500/10"
                            >
                              r/—
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="gap-1 items-center flex">
                            <ThumbsUp className="size-3 text-muted-foreground" />

                            <div>
                              {evaluation.redditPost.score
                                ? evaluation.redditPost.score
                                : "-"}
                            </div>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="gap-1 items-center flex">
                            <MessageCircle className="size-3 text-muted-foreground" />

                            <span>
                              {evaluation.redditPost.numComments
                                ? evaluation.redditPost.numComments
                                : "-"}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap">
                          <span className="text-sm line-clamp-1">
                            {evaluation.redditPost?.title ?? "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow
                          className="bg-muted/20"
                          key={evaluation.id + "-details"}
                        >
                          <TableCell
                            colSpan={6}
                            className="p-0 max-w-full hover:bg-none"
                          >
                            <div className="px-4 py-4 space-y-3 w-full overflow-hidden">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-wrap">
                                <div className="flex flex-col gap-2 col-span-3">
                                  {/* title */}
                                  <span className="font-semibold text-xl">
                                    {evaluation.redditPost?.title ?? "—"}
                                  </span>

                                  {/* Content */}
                                  <span className="text-muted-foreground line-clamp-[10]">
                                    {evaluation.redditPost?.selfText}
                                  </span>

                                  <div className="flex gap-2">
                                    {evaluation.redditPost?.author ? (
                                      <a
                                        href={`https://reddit.com/u/${evaluation.redditPost.author}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block"
                                      >
                                        <Badge
                                          variant="outline"
                                          className="border-0 bg-slate-500/10 text-slate-700 dark:text-slate-300 dark:bg-slate-500/10"
                                        >
                                          u/{evaluation.redditPost.author}
                                        </Badge>
                                      </a>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="border-0 bg-slate-500/10 text-slate-700 dark:text-slate-300 dark:bg-slate-500/10"
                                      >
                                        u/—
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-4 col-span-1">
                                  <Button
                                    className="flex md:w-fit gap-2 items-center"
                                    size={"sm"}
                                    onClick={() => {
                                      //copy example message to clipboard and open reddit post
                                      if (
                                        evaluation.exampleMessage &&
                                        evaluation.redditPost
                                      ) {
                                        navigator.clipboard.writeText(
                                          evaluation.exampleMessage
                                        );
                                        const url = `https://reddit.com${evaluation.redditPost.permalink}`;
                                        window.open(url, "_blank");
                                      }
                                    }}
                                  >
                                    <CopyIcon className="size-4" />
                                    <PlusIcon className="size-4" />
                                    <ExternalLinkIcon className="size-4" />
                                  </Button>

                                  <div className="flex gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant={
                                            evaluation.rating === "POSITIVE"
                                              ? "outline"
                                              : "ghost"
                                          }
                                          size="icon"
                                          aria-label="Mark as positive"
                                          onClick={() =>
                                            updateRating.mutate({
                                              id: evaluation.id,
                                              direction:
                                                evaluation.rating === "POSITIVE"
                                                  ? "clear"
                                                  : "up",
                                            })
                                          }
                                          disabled={updateRating.isPending}
                                        >
                                          <ThumbsUp className="size-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Upvote</TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant={
                                            evaluation.rating === "NEGATIVE"
                                              ? "outline"
                                              : "ghost"
                                          }
                                          size="icon"
                                          aria-label="Mark as negative"
                                          onClick={() =>
                                            updateRating.mutate({
                                              id: evaluation.id,
                                              direction:
                                                evaluation.rating === "NEGATIVE"
                                                  ? "clear"
                                                  : "down",
                                            })
                                          }
                                          disabled={updateRating.isPending}
                                        >
                                          <ThumbsDown className="size-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Downvote</TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          aria-label="Archive evaluation"
                                          onClick={() =>
                                            archiveEvaluation.mutate({
                                              id: evaluation.id,
                                            })
                                          }
                                          disabled={archiveEvaluation.isPending}
                                        >
                                          {archiveEvaluation.isPending ? (
                                            <Loader2 className="size-4 animate-spin" />
                                          ) : (
                                            <ArchiveIcon className="size-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Archive</TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant={
                                            evaluation.exampleEvaluation
                                              ? "outline"
                                              : "ghost"
                                          }
                                          size="icon"
                                          aria-label={
                                            evaluation.exampleEvaluation
                                              ? "Remove from examples"
                                              : "Save as example"
                                          }
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            if (evaluation.exampleEvaluation) {
                                              deleteExampleEvaluation.mutate({
                                                redditPostEvaluationId:
                                                  evaluation.id,
                                              });
                                            } else {
                                              openExampleModal(evaluation);
                                            }
                                          }}
                                          disabled={
                                            saveExampleEvaluation.isPending ||
                                            deleteExampleEvaluation.isPending
                                          }
                                        >
                                          {deleteExampleEvaluation.isPending ? (
                                            <Loader2 className="size-4 animate-spin" />
                                          ) : (
                                            <BookmarkIcon className="size-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {evaluation.exampleEvaluation
                                          ? "Remove from examples"
                                          : "Save as example"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2 text-wrap grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="p-3">
                                  {evaluation.exampleMessage ? (
                                    <div className=" flex flex-col gap-2">
                                      <span className="text-muted-foreground">
                                        Example message:{" "}
                                      </span>
                                      <span>{evaluation.exampleMessage}</span>
                                    </div>
                                  ) : null}
                                </Card>
                                <div className="flex flex-col text-muted-foreground py-2">
                                  <div className="flex flex-col gap-2">
                                    <span>{evaluation.reasoning || "—"}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationBar
        page={page}
        totalPages={totalPages}
        pages={Array.from({ length: totalPages }, (_, i) => i + 1)}
        showLeftEllipsis={page > 3}
        showRightEllipsis={page < totalPages - 2}
        setPage={setPage}
      />
      <ResponsiveModal
        open={exampleModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeExampleModal();
          }
        }}
        title="Save example evaluation"
        description={exampleModalDescription}
      >
        <div className="space-y-4">
          <Textarea
            value={exampleModalContent}
            onChange={(event) => setExampleModalContent(event.target.value)}
            placeholder="Describe the curated answer or example response."
            rows={7}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Existing example message will be overwritten.</span>
            <span>{exampleModalContent.trim().length} characters</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeExampleModal}>
              Cancel
            </Button>
            <Button
              onClick={handleExampleSave}
              disabled={isExampleSaveDisabled}
            >
              {saveExampleEvaluation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save example"
              )}
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}
