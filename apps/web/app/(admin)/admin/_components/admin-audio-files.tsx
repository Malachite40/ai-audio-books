"use client";

import { PaginationBar } from "@/components/pagination-bar";
import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
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
import { Loader, MoreHorizontal, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const PAGE_SIZE = 20;
const AUDIO_STATUSES = [
  "PENDING",
  "GENERATING_STORY",
  "PROCESSING",
  "PROCESSED",
  "ERROR",
] as const;
type AudioStatus = (typeof AUDIO_STATUSES)[number];

export function AdminAudioFilesCard() {
  const [filterStatus, setFilterStatus] = useState<"ALL" | AudioStatus>("ALL");
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch, isFetching } =
    api.audio.fetchAllAdmin.useQuery({
      page,
      pageSize: PAGE_SIZE,
      status: filterStatus === "ALL" ? undefined : filterStatus,
    });

  const rows = useMemo(() => data?.audioFiles ?? [], [data]);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)),
    [data?.total]
  );

  // Simple intersection observer to auto-load next page
  // (Optional: comment out if not desired)
  // useEffect(() => {
  //   if (!hasNextPage) return;
  //   const el = loadMoreRef.current;
  //   if (!el) return;
  //   const obs = new IntersectionObserver((entries) => {
  //     const e = entries[0];
  //     if (e?.isIntersecting && hasNextPage && !isFetchingNextPage && !isLoading) {
  //       fetchNextPage();
  //     }
  //   });
  //   obs.observe(el);
  //   return () => obs.disconnect();
  // }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="text-xl font-semibold">Audio Files</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status</span>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as any)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {AUDIO_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="size-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>
      <Table>
        <TableCaption>All audio files across users.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Speaker</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Public</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                <Loader className="animate-spin size-4 mx-auto" />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                No audio files found.
              </TableCell>
            </TableRow>
          )}

          {rows.map((af) => (
            <TableRow key={af.id}>
              <TableCell className="max-w-[280px] whitespace-nowrap overflow-hidden text-ellipsis">
                {af.name || af.id}
              </TableCell>
              <TableCell>{af.status}</TableCell>
              <TableCell>
                {af.speaker?.displayName || af.speaker?.name}
              </TableCell>
              <TableCell>{af.owner?.name || af.owner?.email || "—"}</TableCell>
              <TableCell>{af.public ? "Yes" : "No"}</TableCell>
              <TableCell>{Math.round((af.durationMs ?? 0) / 1000)}s</TableCell>
              <TableCell>
                {af.createdAt instanceof Date
                  ? af.createdAt.toLocaleString()
                  : new Date((af as any).createdAt).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <RowActions
                    audioFileId={af.id}
                    isPublic={!!af.public}
                    disabled={isFetching || isLoading}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {isFetching && !isLoading && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-4">
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

function RowActions({
  audioFileId,
  isPublic,
  disabled,
}: {
  audioFileId: string;
  isPublic: boolean;
  disabled?: boolean;
}) {
  const utils = api.useUtils();
  const requeue = api.audio.requeue.useMutation({
    onSuccess: () => utils.audio.fetchAllAdmin.invalidate(),
  });
  const del = api.audio.adminDelete.useMutation({
    onSuccess: () => utils.audio.fetchAllAdmin.invalidate(),
  });
  const concat = api.audio.queueConcatAudioFile.useMutation({
    onSuccess: () => utils.audio.fetchAllAdmin.invalidate(),
  });
  const togglePublic = api.audio.togglePublic.useMutation({
    onSuccess: () => utils.audio.fetchAllAdmin.invalidate(),
  });

  const busy = requeue.isPending || del.isPending || concat.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          aria-label="More actions"
          disabled={disabled || busy}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/audio-file/${audioFileId}`}>View</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            await requeue
              .mutateAsync({ audioFileId, mode: "failed" })
              .catch((err) => {
                console.error(err);
              });
          }}
        >
          Re-queue failed chunks
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            if (
              !window.confirm(
                "Rebuild from text (drop all chunks) and reprocess?"
              )
            )
              return;
            await requeue
              .mutateAsync({ audioFileId, mode: "full" })
              .catch((err) => {
                console.error(err);
              });
          }}
        >
          Rebuild from text
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            await togglePublic.mutateAsync({ audioFileId }).catch((err) => {
              console.error(err);
            });
          }}
        >
          {isPublic ? "Make Private" : "Make Public"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            await concat.mutateAsync({ audioFileId }).catch((err) => {
              alert(
                err?.message ??
                  "Unable to queue concat. Ensure all chunks are PROCESSED."
              );
            });
          }}
        >
          Re-stitch final MP3
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            if (
              !window.confirm(
                "Soft delete this audio file? You can restore via DB."
              )
            )
              return;
            await del
              .mutateAsync({ audioFileId, type: "soft" })
              .catch(console.error);
          }}
        >
          Soft delete
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={async (e) => {
            e.preventDefault();
            if (
              !window.confirm(
                "Hard delete this audio file and purge assets? This cannot be undone."
              )
            )
              return;
            await del
              .mutateAsync({ audioFileId, type: "hard", purgeAssets: true })
              .catch(console.error);
          }}
        >
          Hard delete + purge assets
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
