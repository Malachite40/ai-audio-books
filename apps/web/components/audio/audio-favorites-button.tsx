"use client";

import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";

// Forms
import { Loader2, StarIcon } from "lucide-react/icons";

import { AudioFile } from "@workspace/database";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { toast } from "sonner";

export function FavoriteButton({ af }: { af: AudioFile }) {
  const isFavoriteQuery = api.audio.favorites.fetch.useQuery({
    audioFileId: af.id,
  });

  const addFavoriteMutation = api.audio.favorites.add.useMutation({
    onSuccess: () => {
      toast("Added to favorites");
      isFavoriteQuery.refetch();
    },
    onError: () => {
      toast("Failed to add to favorites");
    },
  });

  const removeFavoriteMutation = api.audio.favorites.delete.useMutation({
    onSuccess: () => {
      toast("Removed from favorites");
      isFavoriteQuery.refetch();
    },
    onError: () => {
      toast("Failed to remove from favorites");
    },
  });

  const isFavorite = isFavoriteQuery.data && isFavoriteQuery.data.favorite;

  if (addFavoriteMutation.isPending || removeFavoriteMutation.isPending) {
    return (
      <Button variant="ghost" disabled>
        <Loader2 className="animate-spin size-4" />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          onClick={() => {
            if (isFavorite) {
              removeFavoriteMutation.mutate({ audioFileId: af.id });
            } else {
              addFavoriteMutation.mutate({ audioFileId: af.id });
            }
          }}
        >
          {isFavorite ? (
            <StarIcon className="size-4 fill-primary text-primary" />
          ) : (
            <StarIcon className="size-4 text-foreground/60" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isFavorite ? "Remove from favorites" : "Add to favorites"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
