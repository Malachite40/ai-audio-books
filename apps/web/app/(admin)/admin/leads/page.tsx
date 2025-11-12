"use client";

import { api } from "@/trpc/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PaginationBar } from "@/components/pagination-bar";
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
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

const CATEGORIES = ["new", "hot", "rising", "top", "controversial"] as const;

export default function AdminLeadsPage() {
  const PAGE_SIZE = 25;
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [subreddit, setSubreddit] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [newWatchSubreddit, setNewWatchSubreddit] = useState("");
  const utils = trpc.useUtils();

  // Evaluations state
  const [evalSearch, setEvalSearch] = useState("");
  const [evalQ, setEvalQ] = useState("");
  const [evalSubreddit, setEvalSubreddit] = useState("");
  const [minScore, setMinScore] = useState<number | undefined>(70);
  const [evalPage, setEvalPage] = useState(1);
  // Timeseries (Evaluations) state
  const [tsMinScore, setTsMinScore] = useState<number>(75);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Debounce eval search
  useEffect(() => {
    const t = setTimeout(() => setEvalQ(evalSearch), 300);
    return () => clearTimeout(t);
  }, [evalSearch]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [q, subreddit, category]);

  useEffect(() => {
    setEvalPage(1);
  }, [evalQ, evalSubreddit, minScore]);

  const { data, refetch, isLoading, isFetching } =
    api.reddit.listPosts.useQuery({
      page,
      pageSize: PAGE_SIZE,
      search: q.trim() ? q.trim() : undefined,
      subreddit: subreddit.trim() ? subreddit.trim() : undefined,
      category: (category as any) || undefined,
    });

  const items = useMemo(() => data?.items ?? [], [data]);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)),
    [data?.total]
  );

  // Evaluations query
  const evalQuery = trpc.reddit.listEvaluations.useQuery({
    page: evalPage,
    pageSize: PAGE_SIZE,
    search: evalQ.trim() ? evalQ.trim() : undefined,
    subreddit: evalSubreddit.trim() ? evalSubreddit.trim() : undefined,
    minScore: typeof minScore === "number" ? minScore : undefined,
  });
  const evalItems = useMemo(
    () => evalQuery.data?.items ?? [],
    [evalQuery.data]
  );
  const evalTotalPages = useMemo(
    () => Math.max(1, Math.ceil((evalQuery.data?.total ?? 0) / PAGE_SIZE)),
    [evalQuery.data?.total]
  );

  // Evaluation score timeseries query (30d fixed window)
  const tsQuery = trpc.reddit.evaluationTimeseries.useQuery({
    minScore: typeof tsMinScore === "number" ? tsMinScore : 75,
    days: 30,
    subreddit: evalSubreddit.trim() ? evalSubreddit.trim() : undefined,
  });
  const tsData = useMemo(() => {
    const series = tsQuery.data?.series ?? [];
    return series.map((d) => {
      const day = new Date((d as any).day);
      const date = isNaN(day.getTime())
        ? String((d as any).day).slice(0, 10)
        : day.toISOString().slice(0, 10);
      return { date, count: (d as any).count as number };
    });
  }, [tsQuery.data]);

  // Watch list data + mutations
  const { data: watchData, isLoading: watchLoading } =
    trpc.reddit.listWatchList.useQuery();
  const upsertWatch = trpc.reddit.upsertWatchList.useMutation({
    onSuccess: async () => {
      setNewWatchSubreddit("");
      await utils.reddit.listWatchList.invalidate();
    },
  });
  const deleteWatch = trpc.reddit.deleteWatchList.useMutation({
    onSuccess: async () => {
      await utils.reddit.listWatchList.invalidate();
    },
  });
  const scanWatchSub = trpc.reddit.adminQueueScanSubreddit.useMutation();
  const scanWatchAll = trpc.reddit.adminScanWatchList.useMutation();

  return (
    <div className="space-y-4 container mx-auto ">
      <Tabs defaultValue="eval">
        <TabsList>
          <TabsTrigger value="eval">Watch List + Evaluations</TabsTrigger>
          <TabsTrigger value="posts">Reddit Posts</TabsTrigger>
        </TabsList>
        <TabsContent value="eval" className="space-y-4">
      {/* Watch List Management */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reddit Watch List</h2>
        </div>
        <div className="flex gap-2 max-w-md">
          <Input
            placeholder="Add subreddit (e.g. programming)"
            value={newWatchSubreddit}
            onChange={(e) =>
              setNewWatchSubreddit(e.target.value.replace(/^r\//, ""))
            }
          />
          <Button
            onClick={() => {
              const v = newWatchSubreddit.trim();
              if (v) upsertWatch.mutate({ subreddit: v });
            }}
            disabled={upsertWatch.isPending}
          >
            {upsertWatch.isPending ? "Saving…" : "Upsert"}
          </Button>

          <Button
            onClick={() => scanWatchAll.mutate()}
            disabled={scanWatchAll.isPending}
          >
            {scanWatchAll.isPending ? "Queuing…" : "Scan All"}
          </Button>
        </div>

        <div className="overflow-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subreddit</TableHead>
                <TableHead className="w-[240px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-center py-6 text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : watchData?.items?.length ? (
                watchData.items.map((w) => (
                  <TableRow key={w.subreddit}>
                    <TableCell>r/{w.subreddit}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            scanWatchSub.mutate({ subreddit: w.subreddit })
                          }
                          disabled={scanWatchSub.isPending}
                        >
                          {scanWatchSub.isPending ? "Queuing…" : "Scan"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            deleteWatch.mutate({ subreddit: w.subreddit })
                          }
                          disabled={deleteWatch.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-center py-6 text-muted-foreground"
                  >
                    No watch list items.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

        

        
      {/* Evaluations */}
      <div className="space-y-3 pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reddit Post Evaluations</h2>
          <div className="text-sm text-muted-foreground">
            Auto-scored by AI for backlink opportunities
          </div>
        </div>

        {/* Eval Timeseries: Scores >= threshold over time */}
        <div className="space-y-2">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-sm mb-1">Score threshold</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={tsMinScore}
                onChange={(e) => {
                  const v = e.target.value;
                  setTsMinScore(v ? Math.max(1, Math.min(100, Number(v))) : 75);
                }}
              />
            </div>
            {evalSubreddit && (
              <div className="text-sm text-muted-foreground pb-1">
                Filtering by subreddit: r/{evalSubreddit}
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border">
            <ChartContainer
              config={{ count: { label: `Scores >= ${tsMinScore}`, color: "var(--color-chart-1)" } }}
              className="h-64 w-full"
            >
              <LineChart data={tsData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickMargin={6} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={false} />
                <ChartLegend content={<ChartLegendContent />} />
              </LineChart>
            </ChartContainer>
          </div>
        </div>

        {/* Eval Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="col-span-1">
            <label className="block text-sm mb-1">Search</label>
            <Input
              placeholder="Title or author"
              value={evalSearch}
              onChange={(e) => setEvalSearch(e.target.value)}
            />
          </div>
          <div className="col-span-1">
            <label className="block text-sm mb-1">Subreddit</label>
            <Input
              placeholder="e.g. programming"
              value={evalSubreddit}
              onChange={(e) =>
                setEvalSubreddit(e.target.value.replace(/^r\//, ""))
              }
            />
          </div>
          <div className="col-span-1">
            <label className="block text-sm mb-1">Min Score</label>
            <Input
              type="number"
              min={1}
              max={100}
              value={minScore ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setMinScore(
                  v ? Math.max(1, Math.min(100, Number(v))) : undefined
                );
              }}
            />
          </div>
          <div className="col-span-1 flex items-end gap-2">
            <Button
              variant="outline"
              onClick={() => evalQuery.refetch()}
              disabled={evalQuery.isFetching}
            >
              {evalQuery.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
            {(evalSearch || evalSubreddit || typeof minScore === "number") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEvalSearch("");
                  setEvalQ("");
                  setEvalSubreddit("");
                  setMinScore(70);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Evaluated</TableHead>
                <TableHead>Subreddit</TableHead>
                <TableHead className="min-w-[360px]">Title</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Example Response</TableHead>
                <TableHead className="min-w-[400px]">Reasoning</TableHead>
                <TableHead>Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evalItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No evaluations yet.
                  </TableCell>
                </TableRow>
              ) : (
                evalItems.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {new Date(
                        r.createdAt as unknown as string
                      ).toLocaleString()}
                    </TableCell>
                    <TableCell>r/{r.redditPost.subreddit}</TableCell>
                    <TableCell className="whitespace-pre-wrap">
                      {r.redditPost.title}
                    </TableCell>
                    <TableCell>{r.score}</TableCell>
                    <TableCell className="whitespace-pre-wrap">
                      {r.exampleMessage}
                    </TableCell>
                    <TableCell className="whitespace-pre-wrap">
                      {r.reasoning}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Link
                        className="underline"
                        href={`https://www.reddit.com${r.redditPost.permalink}`}
                        target="_blank"
                      >
                        Reddit
                      </Link>
                      {r.redditPost.url && (
                        <a
                          className="underline"
                          href={r.redditPost.url}
                          target="_blank"
                        >
                          Source
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4">
          <PaginationBar
            page={evalPage}
            totalPages={evalTotalPages}
            pages={Array.from({ length: evalTotalPages }, (_, i) => i + 1)}
            showLeftEllipsis={evalPage > 3}
            showRightEllipsis={evalPage < evalTotalPages - 2}
            setPage={setEvalPage}
          />
        </div>
      </div>
        </TabsContent>

        <TabsContent value="posts" className="space-y-4">
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
              <TableHead>Category</TableHead>
              <TableHead className="min-w-[360px]">Title</TableHead>
              <TableHead>Author</TableHead>
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
                <TableRow key={p.id}>
                  <TableCell>
                    {new Date(
                      p.createdUtc as unknown as string
                    ).toLocaleString()}
                  </TableCell>
                  <TableCell>r/{p.subreddit}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell className="whitespace-pre-wrap">
                    {p.title}
                  </TableCell>
                  <TableCell>{p.author ?? "—"}</TableCell>
                  <TableCell>{p.score ?? "—"}</TableCell>
                  <TableCell>{p.numComments ?? "—"}</TableCell>
                  <TableCell className="space-x-2">
                    <Link
                      className="underline"
                      href={`https://www.reddit.com${p.permalink}`}
                      target="_blank"
                    >
                      Reddit
                    </Link>
                    {p.url && (
                      <a className="underline" href={p.url} target="_blank">
                        Source
                      </a>
                    )}
                  </TableCell>
                </TableRow>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
