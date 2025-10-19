import z from "zod";

export const sectionType = z.enum([
  "chapter",
  "prologue",
  "epilogue",
  "preface",
  "foreword",
  "part",
  "book",
  "scene",
  "section",
  "other",
]);

export const splitIntoSentences = (raw: string): string[] => {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return [];
  try {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const seg = new Intl.Segmenter("en", {
        granularity: "sentence",
      });
      const out: string[] = [];
      for (const { segment } of seg.segment(text)) {
        const s = String(segment).trim();
        if (s) out.push(s);
      }
      if (out.length) return out;
    }
  } catch {}
  const rx = /[^.!?…]+(?:\.\.\.|[.!?]|…)+(?=\s+|$)|[^.!?…]+$/g;
  const matches = text.match(rx) ?? [];
  return matches.map((s) => s.trim());
};

export const softWrap = (sentence: string, limit: number): string[] => {
  if (sentence.length <= limit) return [sentence];
  const words = sentence.split(/\s+/);
  const out: string[] = [];
  let buf = "";
  for (const w of words) {
    const next = buf ? `${buf} ${w}` : w;
    if (next.length > limit && buf) {
      out.push(buf);
      buf = w;
    } else {
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out;
};

export const buildChunks = (sentences: string[], limit: number): string[] => {
  const chunks: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = "";
  };
  for (const s0 of sentences) {
    const pieces = softWrap(s0, limit);
    for (const s of pieces) {
      const candidate = buf ? `${buf} ${s}` : s;
      if (candidate.length > limit && buf) {
        flush();
        buf = s;
      } else {
        buf = candidate;
      }
    }
  }
  flush();
  return chunks;
};

export const createChunksFromChapters = ({
  chapters,
}: {
  chapters: {
    title: string;
    text: string;
    type: z.infer<typeof sectionType>;
  }[];
}) => {
  let sequence = 0;
  const chunks: {
    text: string;
    sequence: number;
    paddingEndMs: number;
  }[] = [];

  for (const chapter of chapters) {
    // Add title as its own chunk
    if (chapter.type !== "scene") {
      chunks.push({
        text: chapter.title,
        sequence,
        paddingEndMs: 1500,
      });
      sequence++;
    }
    // Split text into sentences and build chunks
    const sentences = splitIntoSentences(chapter.text);
    const chunkTexts = buildChunks(sentences, 2000);
    for (const [i, text] of chunkTexts.entries()) {
      chunks.push({
        text,
        sequence,
        paddingEndMs: i === chunkTexts.length - 1 ? 1500 : 500,
      });
      sequence++;
    }
  }
  return chunks;
};
