import { api } from "@/trpc/server";
import { Card } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { AdminAudioFileActions } from "../../_components/admin-audio-file-actions";
import type { Route } from "next";
import { AudioChunksTable } from "./_components/audio-chunks-table";
import { formatDurationHMS } from "../../_components/format-duration";

type tParams = Promise<{ id: string }>; 

export default async function AdminAudioDetailPage({
  params,
}: {
  params: tParams;
}) {
  const { id } = await params;
  const { audioFile } = await api.audio.adminFetchById({ id });

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">
                {audioFile.name || audioFile.id}
              </h2>
              <Badge variant={audioFile.status === "ERROR" ? "destructive" : "secondary"}>
                {audioFile.status}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground flex flex-wrap gap-4">
              <span>
                Speaker: {audioFile.speaker?.displayName || audioFile.speaker?.name}
              </span>
              <span>Owner: {audioFile.owner?.name || audioFile.owner?.email || "—"}</span>
              <span>Public: {audioFile.public ? "Yes" : "No"}</span>
              <span>Duration: {formatDurationHMS(audioFile.durationMs)}</span>
              <span>Created: {new Date(audioFile.createdAt as any).toLocaleString()}</span>
            </div>
          </div>
          <div>
            <AdminAudioFileActions
              audioFileId={audioFile.id}
              isPublic={!!audioFile.public}
              disabled={false}
              viewHref={`/admin/audio/${audioFile.id}` as Route}
            />
          </div>
        </div>
      </Card>

      <AudioChunksTable audioFileId={audioFile.id} />
    </div>
  );
}
