import { useAreYouSure } from "@/hooks/use-are-you-sure";
import { usePagination } from "@/hooks/use-pagination";
import { useAudioHistoryStore } from "@/store/use-audio-history-store";
import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { format } from "date-fns";
import { Loader, Trash2 } from "lucide-react";
import { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { PaginationBar } from "../pagination-bar";
// Audio History component
interface AudioHistoryProps {}
const pageSize = 5;
export const AudioHistory = ({}: AudioHistoryProps) => {
  const [page, setPage] = useState(1);
  const pathname = usePathname();
  const router = useRouter();

  const { open, setOpen: setAudioHistoryOpen } = useAudioHistoryStore();

  const [selectedAudioFileId, setSelectedAudioFileId] = useQueryState(
    "id",
    parseAsString.withDefault("").withOptions({})
  );

  const audioFileQuery = api.audio.fetchAll.useQuery({
    take: pageSize,
    page,
  });

  const totalCount = audioFileQuery.data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage: page ?? 1,
    totalPages,
    paginationItemsToDisplay: 5,
  });

  const deleteAudioFileMutation = api.audio.delete.useMutation({
    onSuccess: async () => {
      audioFileQuery.refetch();
    },
    onError: (error) => {
      // Handle error (e.g., show an error message)
    },
  });

  const { AreYouSure, showAreYouSure, setShowAreYouSure, setObject, object } =
    useAreYouSure<{ id: string; name: string }>();

  return (
    <div className="">
      <AreYouSure
        title={`Are you sure you want to delete ${object?.name}?`}
        onCancel={async () => {
          setShowAreYouSure(false);
        }}
        onConfirm={async () => {
          if (!object) return;
          deleteAudioFileMutation.mutate({
            id: object.id,
          });
        }}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sm:max-w-none max-w-[100px] overflow-ellipsis">
              Name
            </TableHead>
            <TableHead>Speaker</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12 text-center">Delete</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {audioFileQuery.isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8">
                <Loader className="animate-spin size-4 mx-auto" />
              </TableCell>
            </TableRow>
          ) : (
            audioFileQuery.data?.audioFiles.map((af) => {
              const isDeleting =
                deleteAudioFileMutation.variables?.id === af.id &&
                deleteAudioFileMutation.isPending;
              return (
                <TableRow
                  onClick={() => {
                    // if not on root
                    if (pathname !== "/") {
                      router.push(`/?id=${af.id}` as Route);
                    } else {
                      setSelectedAudioFileId(af.id);
                    }
                    setAudioHistoryOpen(false);
                  }}
                  key={af.id}
                  className={
                    `cursor-pointer` +
                    (selectedAudioFileId === af.id
                      ? " bg-primary text-background hover:bg-primary/80 hover:text-background"
                      : "")
                  }
                >
                  <TableCell>
                    <div className="sm:max-w-none max-w-[100px] overflow-ellipsis line-clamp-1 h-full">
                      {af.name}
                    </div>
                  </TableCell>

                  <TableCell>{af.speaker.name}</TableCell>
                  <TableCell>
                    {format(new Date(af.createdAt), "MM-dd h a")}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      aria-label="Delete audio file"
                      disabled={isDeleting}
                      variant={
                        selectedAudioFileId === af.id ? "secondary" : "ghost"
                      }
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
            })
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5}>Total: {totalCount}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <div className="mt-2">
        <PaginationBar
          page={page ?? 1}
          totalPages={totalPages}
          pages={pages}
          showLeftEllipsis={showLeftEllipsis}
          showRightEllipsis={showRightEllipsis}
          setPage={setPage}
        />
      </div>
    </div>
  );
};
