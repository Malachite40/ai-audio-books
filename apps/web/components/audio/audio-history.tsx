import { useAreYouSure } from "@/hooks/use-are-you-sure";
import { useAudioHistoryStore } from "@/store/use-audio-history-store";
import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Loader, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
// Audio History component
interface AudioHistoryProps {}

const PAGE_SIZE = 10;

export const AudioHistory = ({}: AudioHistoryProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { open, setOpen: setAudioHistoryOpen } = useAudioHistoryStore();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = api.audio.fetchAll.useInfiniteQuery(
    { limit: PAGE_SIZE },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const allAudioFiles = data?.pages.flatMap((page) => page.audioFiles) ?? [];

  const deleteAudioFileMutation = api.audio.delete.useMutation({
    onSuccess: async () => {
      refetch();
    },
    onError: (error) => {
      // Handle error (e.g., show an error message)
    },
  });

  const { AreYouSure, showAreYouSure, setShowAreYouSure, setObject, object } =
    useAreYouSure<{ id: string; name: string }>();

  // --- Infinite scroll sentinel ---
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasNextPage) return;

    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]!;
        // Trigger early, avoid duplicate calls while already fetching
        if (
          entry.isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage &&
          !isLoading
        ) {
          fetchNextPage();
        }
      },
      {
        root: null, // viewport; change to a scroll container element if needed
        rootMargin: "1000px 0px", // start loading well before the bottom
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => {
      observer.unobserve(el);
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  return (
    <div className="">
      <AreYouSure
        title={`Are you sure you want to delete ${object?.name}?`}
        onCancel={async () => {
          setShowAreYouSure(false);
        }}
        onConfirm={async () => {
          if (!object) return;
          deleteAudioFileMutation.mutate({ id: object.id });
        }}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead className="sm:max-w-none max-w-[100px] overflow-ellipsis">
              Name
            </TableHead>
            <TableHead className="w-12 text-center"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8">
                <Loader className="animate-spin size-4 mx-auto" />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && allAudioFiles.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8">
                No audio files found.
              </TableCell>
            </TableRow>
          )}

          {allAudioFiles.map((af) => {
            const isDeleting =
              deleteAudioFileMutation.variables?.id === af.id &&
              deleteAudioFileMutation.isPending;

            return (
              <TableRow
                onClick={() => {
                  if (pathname !== "/") {
                    router.push(`/audio-file/${af.id}`);
                  } else {
                  }
                  setAudioHistoryOpen(false);
                }}
                key={af.id}
                className={`cursor-pointer`}
              >
                <TableCell className="p-0">
                  {/* Image */}
                  {af.imageUrl ? (
                    <img
                      src={af.imageUrl}
                      alt={af.name}
                      className="size-9 aspect-square object-cover rounded-lg shadow-xs"
                    />
                  ) : (
                    <div className="size-9 aspect-square bg-muted rounded-lg flex justify-center items-center shadow-xs">
                      <p className="text-sm text-muted-foreground"></p>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="sm:max-w-none max-w-[210px] overflow-ellipsis line-clamp-1 h-full">
                    {af.name}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    size="sm"
                    aria-label="Delete audio file"
                    disabled={isDeleting}
                    variant={"ghost"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setObject({ id: af.id, name: af.name });
                      setShowAreYouSure(true);
                    }}
                  >
                    {isDeleting ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}

          {/* Spinner row while fetching the next page */}
          {isFetchingNextPage && !isLoading && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-4">
                <Loader className="animate-spin size-4 mx-auto" />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Sentinel for infinite scroll (replaces the Load More button) */}
      {hasNextPage && (
        <div ref={loadMoreRef} aria-hidden className="h-8 w-full" />
      )}
    </div>
  );
};
