"use client";

import Link from "next/link";
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

const CATEGORIES = ["new", "hot", "rising", "top", "controversial"] as const;
const PAGE_SIZE = 25;

export function LeadsPosts() {
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
  }, [q, subreddit, category]);

  const { data, refetch, isFetching } = api.reddit.listPosts.useQuery({
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
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
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
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No posts yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {new Date(p.createdUtc as unknown as string).toLocaleString()}
                  </TableCell>
                  <TableCell>r/{p.subreddit}</TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell className="whitespace-pre-wrap">{p.title}</TableCell>
                  <TableCell>{p.author ?? "—"}</TableCell>
                  <TableCell>{p.score ?? "—"}</TableCell>
                  <TableCell>{p.numComments ?? "—"}</TableCell>
                  <TableCell className="space-x-2">
                    <Link className="underline" href={`https://www.reddit.com${p.permalink}`} target="_blank">
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
    </div>
  );
}

