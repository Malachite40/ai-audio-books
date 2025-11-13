"use client";

import { useEffect, useMemo, useState } from "react";

import { PaginationBar } from "@/components/pagination-bar";
import { api } from "@/trpc/react";
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
import { ExternalLink, Loader2, MessageSquare } from "lucide-react";
import React from "react";

const CATEGORIES = ["new", "hot", "rising", "top", "controversial"] as const;
const PAGE_SIZE = 25;

type LeadsPostsProps = {
  campaignId?: string;
};

export function LeadsPosts({ campaignId }: LeadsPostsProps) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [subreddit, setSubreddit] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [q, subreddit, category, campaignId]);

  useEffect(() => {
    setCommentsByPost({});
    setOpenRow({});
  }, [campaignId]);

  const { data, refetch, isFetching } = api.reddit.listPosts.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search: q.trim() ? q.trim() : undefined,
    subreddit: subreddit.trim() ? subreddit.trim() : undefined,
    category: (category as any) || undefined,
    campaignId,
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)),
    [data?.total]
  );

  // Comments fetching + row expansion state
  const getComments = api.reddit.getPostComments.useMutation();
  const [commentsByPost, setCommentsByPost] = useState<Record<string, any[]>>(
    {}
  );
  const [openRow, setOpenRow] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="col-span-1">
          <label className="block text-sm mb-1">Search</label>
          <Input
            placeholder="Title or author"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="col-span-1">
          <label className="block text-sm mb-1">Subreddit</label>
          <Input
            placeholder="e.g. programming"
            value={subreddit}
            onChange={(e) => setSubreddit(e.target.value.replace(/^r\//, ""))}
          />
        </div>

        <div className="col-span-1">
          <label className="block text-sm mb-1">Category</label>
          <Select
            value={category ?? ""}
            onValueChange={(v) => setCategory(v || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-1 flex items-end gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          {(search || subreddit || category) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setQ("");
                setSubreddit("");
                setCategory(undefined);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">Created</TableHead>
              <TableHead>Subreddit</TableHead>
              <TableHead className="min-w-[360px]">Title</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Comments</TableHead>
              <TableHead>Links</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No posts yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((p) => (
                <React.Fragment key={p.id}>
                  <TableRow key={p.id}>
                    <TableCell>
                      {new Date(
                        p.createdUtc as unknown as string
                      ).toLocaleString()}
                    </TableCell>
                    <TableCell>r/{p.subreddit}</TableCell>
                    <TableCell className="whitespace-pre-wrap">
                      <span className="line-clamp-1">{p.title}</span>
                    </TableCell>
                    <TableCell>{p.score ?? "—"}</TableCell>
                    <TableCell>{p.numComments ?? "—"}</TableCell>
                    <TableCell className="space-x-2">
                      <TooltipProvider delayDuration={0}>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`https://reddit.com${p.permalink}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="Open on Reddit"
                                >
                                  <ExternalLink className="size-4" />
                                </Button>
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>Open on Reddit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={async () => {
                                  // Toggle open if comments already fetched
                                  const has =
                                    Array.isArray(commentsByPost[p.id]) &&
                                    (commentsByPost[p.id]?.length ?? 0) > 0;
                                  if (has) {
                                    setOpenRow((prev) => ({
                                      ...prev,
                                      [p.id]: !prev[p.id],
                                    }));
                                    return;
                                  }
                                  // Fetch then open
                                  const res = await getComments.mutateAsync({
                                    permalink: p.permalink,
                                  });
                                  setCommentsByPost((prev) => ({
                                    ...prev,
                                    [p.id]: res.items || [],
                                  }));
                                  setOpenRow((prev) => ({
                                    ...prev,
                                    [p.id]: true,
                                  }));
                                }}
                                aria-label="Fetch comments"
                                disabled={
                                  getComments.isPending &&
                                  (getComments as any)?.variables?.permalink ===
                                    p.permalink
                                }
                              >
                                {getComments.isPending &&
                                (getComments as any)?.variables?.permalink ===
                                  p.permalink ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <MessageSquare className="size-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {openRow[p.id]
                                ? "Hide comments"
                                : commentsByPost[p.id]?.length
                                  ? "Show comments"
                                  : "Fetch comments"}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                  {openRow[p.id] ? (
                    <TableRow>
                      <TableCell colSpan={8} className="p-0">
                        <div className="border-t border-border bg-muted/20">
                          <div className="p-3">
                            {(() => {
                              const postComments = commentsByPost[p.id] ?? [];
                              return postComments.length ? (
                                <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                                  {postComments.map((c: any) => {
                                    const depth = Math.min(
                                      6,
                                      Number(c.depth ?? 0)
                                    );
                                    const initial = (
                                      c.author?.[0] ?? "?"
                                    ).toUpperCase();
                                    return (
                                      <a
                                        key={c.id}
                                        href={`https://reddit.com${p.permalink}?comment=${c.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block rounded-2xl border border-border bg-card/80 p-3 shadow-sm hover:bg-accent/30 cursor-pointer"
                                        style={{
                                          marginLeft: `${depth * 16}px`,
                                        }}
                                      >
                                        <div className="flex items-start gap-3">
                                          {c.authorIcon ? (
                                            <img
                                              className="h-9 w-9 rounded-full object-cover"
                                              src={c.authorIcon}
                                              alt={c.author ?? "avatar"}
                                            />
                                          ) : (
                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                                              {initial}
                                            </div>
                                          )}
                                          <div className="flex-1 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                              <span className="font-medium text-foreground">
                                                {c.author ?? "[deleted]"}
                                              </span>
                                              {typeof c.score === "number" ? (
                                                <span>• {c.score} pts</span>
                                              ) : null}
                                              {c.createdUtc ? (
                                                <span>
                                                  •{" "}
                                                  {new Date(
                                                    c.createdUtc
                                                  ).toLocaleString()}
                                                </span>
                                              ) : null}
                                            </div>
                                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                              {c.body || "—"}
                                            </div>
                                          </div>
                                        </div>
                                      </a>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  No comments found.
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="mt-4">
        <PaginationBar
          page={page}
          totalPages={totalPages}
          pages={Array.from({ length: totalPages }, (_, i) => i + 1)}
          showLeftEllipsis={page > 3}
          showRightEllipsis={page < totalPages - 2}
          setPage={setPage}
        />
      </div>
    </div>
  );
}
