"use client";
import AudioClip from "@/components/audio/audio-clip";

import { AudioFile } from "@workspace/database";
const ViewAudioClient = ({ af }: { af: AudioFile }) => {
  return (
    <>
      <div className="container mx-auto p-4 flex flex-col md:justify-center max-w-5xl">
        {/* Render Audio */}
        <div className="flex flex-col gap-4">
          <AudioClip af={af} />
        </div>
      </div>
    </>
  );
};

export default ViewAudioClient;
