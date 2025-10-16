"use client";

import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";

export function AdminAudioFileActions({
  audioFileId,
  isPublic,
  disabled,
  viewHref = `/admin/audio/${audioFileId}`,
  onAfterAction,
}: {
  audioFileId: string;
  isPublic: boolean;
  disabled?: boolean;
  viewHref?: string;
  onAfterAction?: () => void | Promise<void>;
}) {
  const utils = api.useUtils();
  const requeue = api.audio.requeue.useMutation({
    onSuccess: async () => {
      await utils.audio.fetchAllAdmin.invalidate();
      await onAfterAction?.();
    },
  });
  const del = api.audio.adminDelete.useMutation({
    onSuccess: async () => {
      await utils.audio.fetchAllAdmin.invalidate();
      await onAfterAction?.();
    },
  });
  const concat = api.audio.queueConcatAudioFile.useMutation({
    onSuccess: async () => {
      await utils.audio.fetchAllAdmin.invalidate();
      await onAfterAction?.();
    },
  });
  const togglePublic = api.audio.togglePublic.useMutation({
    onSuccess: async () => {
      await utils.audio.fetchAllAdmin.invalidate();
      await onAfterAction?.();
    },
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
          <Link href={viewHref}>View</Link>
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
