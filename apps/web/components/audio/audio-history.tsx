import { Clip } from "@/store/audio-clips-store";
import { AudioClip } from "./audio-clip";

// Audio History component
interface AudioHistoryProps {
  audioHistory: Clip[];
}

export const AudioHistory = ({ audioHistory }: AudioHistoryProps) => {
  if (audioHistory.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4">Audio History</h2>
      <div className="space-y-4">
        {audioHistory.map((clip) => (
          <AudioClip key={clip.id} clip={clip} />
        ))}
      </div>
    </div>
  );
};
