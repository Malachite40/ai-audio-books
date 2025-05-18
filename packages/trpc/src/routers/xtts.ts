import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
// No need to import fetch, using native fetch

const XTTS_API_URL = "http://charhub-inference-5:8000"; // Define the API endpoint

export const xttsRouter = createTRPCRouter({
  getStudioSpeakers: publicProcedure.query(async ({}) => {
    // Added async
    try {
      const response = await fetch(`${XTTS_API_URL}/studio_speakers`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const speakers = await response.json();
      // Assuming the API returns an array of speakers with token and name
      return {
        speakers: speakers as Record<
          string,
          {
            speaker_embedding: number[];
            gpt_cond_latent: number[][];
          }
        >,
      };
    } catch (error) {
      console.error("Error fetching speakers:", error);
      throw new Error("Failed to fetch speakers.");
    }
  }),
  getLanguages: publicProcedure.query(async ({}) => {
    // Added async
    try {
      const response = await fetch(`${XTTS_API_URL}/languages`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const languages = await response.json();
      // Assuming the API returns an array of languages with code and name
      return languages as string[];
    } catch (error) {
      console.error("Error fetching languages:", error);
      throw new Error("Failed to fetch languages.");
    }
  }),
  ttsStream: publicProcedure
    .input(
      z.object({ text: z.string(), speaker: z.string(), language: z.string() })
    )
    .mutation(async ({ input }) => {
      // Added async
      try {
        const response = await fetch(`${XTTS_API_URL}/tts_stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Assuming the API returns a URL or data for the stream
        // This part might need adjustment based on the actual API response for streaming
        const audioData = await response.text(); // Or response.blob() or response.json()
        return audioData; // Return the appropriate data for the frontend to handle streaming
      } catch (error) {
        console.error("Streaming synthesis error:", error);
        throw new Error("Failed to perform streaming synthesis.");
      }
    }),
  tts: publicProcedure
    .input(
      z.object({
        speakerId: z.string(),
        text: z.string(),
        language: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const speaker = await ctx.db.speaker.findUnique({
        where: { id: input.speakerId },
      });
      if (!speaker) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Speaker not found`,
        });
      }

      // 1️⃣ Split text into chunks of ≤ chunkSize chars by sentence boundaries
      const chunkSize = 200;
      const sentences = input.text.match(/[^\.!\?]+[\.!\?]+/g) || [];
      const chunks: string[] = [];
      let bufferText = "";

      for (const sentence of sentences) {
        if ((bufferText + sentence).length > chunkSize && bufferText) {
          chunks.push(bufferText);
          bufferText = sentence;
        } else {
          bufferText += sentence;
        }
      }
      if (bufferText) chunks.push(bufferText);

      // 2️⃣ For each chunk, fetch WAV (JSON or raw), decode, strip header
      const pcmBuffers: Buffer[] = [];
      for (const chunk of chunks) {
        let resp: Response;
        try {
          resp = await fetch(`${XTTS_API_URL}/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: chunk,
              speaker_embedding: speaker.speakerEmbedding,
              gpt_cond_latent: speaker.gptCondLatent,
              language: input.language,
            }),
          });
        } catch (err: unknown) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `Could not reach TTS server: ${
              err instanceof Error ? err.message : String(err)
            }`,
          });
        }

        if (!resp.ok) {
          const txt = await resp.text();
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `TTS service error ${resp.status}: ${txt}`,
          });
        }

        const contentType = resp.headers.get("Content-Type") || "";
        let wavBuffer: Buffer;

        if (contentType.includes("application/json")) {
          // JSON branch: parse base64 string
          const maybeB64 = await resp.json();
          if (typeof maybeB64 !== "string") {
            throw new TRPCError({
              code: "BAD_GATEWAY",
              message: `Unexpected JSON payload: ${JSON.stringify(maybeB64)}`,
            });
          }
          wavBuffer = Buffer.from(maybeB64, "base64");
        } else {
          // Raw-bytes branch
          const array = await resp.arrayBuffer();
          wavBuffer = Buffer.from(array);
        }

        if (wavBuffer.length <= 44) {
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `Received buffer too small to be WAV (${wavBuffer.length} bytes)`,
          });
        }

        // strip off the 44-byte WAV header, keep only PCM
        pcmBuffers.push(wavBuffer.slice(44));
      }

      // 3️⃣ Concatenate PCM chunks, wrap in one WAV, and return data URL
      const combinedPcm = Buffer.concat(pcmBuffers);
      const fullWav = pcmToWavBuffer(combinedPcm);
      const base64 = fullWav.toString("base64");
      return {
        src: `data:audio/wav;base64,${base64}`,
        text: input.text,
        speakerId: input.speakerId,
        language: input.language,
      };
    }),
});

function pcmToWavBuffer(pcm: Buffer): Buffer {
  const numChannels = 1;
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcm.copy(buffer, 44);
  return buffer;
}
