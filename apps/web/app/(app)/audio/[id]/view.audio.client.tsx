"use client";
import AudioClip from "@/components/audio/audio-clip";
import { z } from "zod";

import { AudioFile } from "@workspace/database";
import { useRouter } from "next/navigation";

// --- Schema ---
const FormSchema = z.object({
  name: z.string().min(2, "Please enter a name.").max(100),
  speakerId: z.string().uuid().min(1, "Please select a speaker."),
  text: z.string().min(1, "Please enter text to synthesize."),
  public: z.boolean(),
});

// --- RoyalRoad helpers (client-only import flow) ---

const ViewAudioClient = ({ af }: { af: AudioFile }) => {
  const router = useRouter();

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
