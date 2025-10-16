"use client";

import { useMemo, useState } from "react";
import { api } from "@/trpc/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Card } from "@workspace/ui/components/card";
import { PaginationBar } from "@/components/pagination-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import Link from "next/link";
import { AdminAudioFileActions } from "../../../_components/admin-audio-file-actions";
import type { Route } from "next";

const PAGE_SIZE = 20;
const STATUSES = ["PENDING", "GENERATING_STORY", "PROCESSING", "PROCESSED", "ERROR"] as const;

export default function UserAudioFiles({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<undefined | (typeof STATUSES)[number]>(undefined);
  const { data, isLoading } = api.audio.adminListByUser.useQuery({ userId, page, pageSize: PAGE_SIZE, status });
  const items = data?.audioFiles ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Provide an invalidate hook for child actions
  const utils = api.useUtils();
  const onChanged = async () => {
    await utils.audio.adminListByUser.invalidate({ userId, page, pageSize: PAGE_SIZE, status });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{total.toLocaleString()} audio files</div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status</span>
          <Select value={status ?? "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? undefined : (v as any))}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[120px] text-right">Duration</TableHead>
              <TableHead className="w-[180px]">Created</TableHead>
              <TableHead className="w-[80px] text-center">Public</TableHead>
              <TableHead className="w-[160px]">Speaker</TableHead>
              <TableHead className="w-[60px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  No audio files.
                </TableCell>
              </TableRow>
            )}
            {items.map((af) => (
              <TableRow key={af.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <Link href={`/admin/audio/${af.id}`} className="font-medium hover:underline">
                      {af.name || "Untitled"}
                    </Link>
                    <div className="text-xs text-muted-foreground">{af.id}</div>
                  </div>
                </TableCell>
                <TableCell className="uppercase text-xs tracking-wide text-muted-foreground">{af.status}</TableCell>
                <TableCell className="text-right">{Math.round((af.durationMs || 0) / 1000)}s</TableCell>
                <TableCell>{new Date(af.createdAt as any).toLocaleString()}</TableCell>
                <TableCell className="text-center">{af.public ? "Yes" : "No"}</TableCell>
                <TableCell>{af.speaker?.displayName || af.speaker?.name || "—"}</TableCell>
                <TableCell className="text-right">
                  <AdminAudioFileActions
                    audioFileId={af.id}
                    isPublic={af.public}
                    viewHref={`/admin/audio/${af.id}` as Route}
                    onAfterAction={onChanged}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        pages={Array.from({ length: totalPages }, (_, i) => i + 1)}
        showLeftEllipsis={page > 3}
        showRightEllipsis={page < totalPages - 2}
        setPage={setPage}
      />
    </div>
  );
}
