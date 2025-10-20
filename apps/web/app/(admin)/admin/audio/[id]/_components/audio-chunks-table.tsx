"use client";

import { PaginationBar } from "@/components/pagination-bar";
import { api } from "@/trpc/react";
import { Card } from "@workspace/ui/components/card";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Loader } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDurationHMS } from "../../../_components/format-duration";

const PAGE_SIZE = 50;
const CHUNK_STATUSES = ["PENDING", "PROCESSING", "PROCESSED", "ERROR"] as const;
type ChunkStatus = (typeof CHUNK_STATUSES)[number];

export function AudioChunksTable({ audioFileId }: { audioFileId: string }) {
  const [status, setStatus] = useState<"ALL" | ChunkStatus>("ALL");
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, refetch } = api.audio.adminListChunks.useQuery({
    audioFileId,
    page,
    pageSize: PAGE_SIZE,
    status: status === "ALL" ? undefined : status,
  });

  const rows = useMemo(() => data?.items ?? [], [data]);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)),
    [data?.total]
  );

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-lg font-semibold">Chunks</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status</span>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {CHUNK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <Table>
        <TableCaption>All chunks for this audio file.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Padding</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Text</TableHead>
            <TableHead>URL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8">
                <Loader className="animate-spin size-4 mx-auto" />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8">
                No chunks found.
              </TableCell>
            </TableRow>
          )}

          {rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.sequence}</TableCell>
              <TableCell>{c.status}</TableCell>
              <TableCell>{formatDurationHMS(c.durationMs)}</TableCell>
              <TableCell>
                {c.paddingStartMs} / {c.paddingEndMs}
              </TableCell>
              <TableCell>
                {c.createdAt instanceof Date
                  ? c.createdAt.toLocaleString()
                  : new Date((c as any).createdAt).toLocaleString()}
              </TableCell>
              <TableCell className="max-w-[420px] whitespace-nowrap overflow-hidden text-ellipsis">
                {c.text}
              </TableCell>
              <TableCell>
                {c.url ? (
                  <a
                    className="text-primary underline"
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    open
                  </a>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
          {isFetching && !isLoading && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-4">
                <Loader className="animate-spin size-4 mx-auto" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
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
    </Card>
  );
}
