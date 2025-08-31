import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

type StoryResult = { title: string; story: string };

const TitleSchema = z.object({
  title: z.string().max(60, "Title must be ≤ 60 characters").min(3),
});

const StorySchema = z.object({
  title: z.string().max(60),
  story: z.string().min(1),
});

/** Approx chars → token budget with slack */
const tokensForChars = (chars: number) => Math.ceil((chars / 4) * 1.2);

/** Small retry helper with linear backoff */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries = 2
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`${label} failed after ${retries + 1} attempts: ${msg}`);
}

/** Try hard to parse JSON (handles stray text around JSON if model slips) */
function robustJsonParse<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Could not find valid JSON in model output.");
  }
}

/** Trim to nearest sentence/paragraph boundary ≤ maxChars */
function smartTrim(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastBoundary = Math.max(
    slice.lastIndexOf("\n\n"),
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? ")
  );
  return slice
    .slice(0, lastBoundary > maxChars * 0.7 ? lastBoundary + 1 : slice.length)
    .trim();
}

/** Ensure title meets length; if not, rewrite to ≤ 60 chars using generateText */
async function ensureTitleWithinLimit(title: string): Promise<string> {
  if (title.length <= 60) return title;
  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    maxOutputTokens: 64,
    prompt: `
Rewrite this story title to be ≤ 60 characters, evocative, spoiler-free.
Return ONLY the rewritten title text (no quotes, no JSON).

Original: ${title}
    `.trim(),
  });
  const cleaned = text.trim().replace(/^["'“”]+|["'“”]+$/g, "");
  return cleaned.slice(0, 60).trim();
}

/** First call: produce a title for the story (JSON) */
async function createTitle(premise: string): Promise<string> {
  const raw = await withRetry(async () => {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      maxOutputTokens: 120,
      prompt: `
Return ONLY JSON: {"title": string ≤ 60 chars}

TASK
Create an evocative, spoiler-free title for a short story based on the user's premise. 
Avoid copyrighted names unless supplied.

PREMISE
${premise}
        `.trim(),
    });
    return text;
  }, "Title generation");

  let parsed = TitleSchema.parse(robustJsonParse<{ title: string }>(raw));
  parsed.title = await ensureTitleWithinLimit(parsed.title);
  return parsed.title;
}

export async function generateStory({
  duration,
  prompt,
}: {
  duration: number;
  prompt: string;
}): Promise<StoryResult> {
  try {
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("`duration` must be a positive number of minutes.");
    }
    if (!prompt?.trim()) {
      throw new Error("`prompt` must be a non-empty string.");
    }

    // 0) Compute length bounds
    const targetChars = Math.round(duration * 1200);
    const minChars = Math.max(500, Math.round(targetChars * 0.9));
    const maxChars = Math.round(targetChars * 1.1);
    const headroomTokens = tokensForChars(maxChars);

    // 1) First call: create title
    const storyTitle = await createTitle(prompt);

    // 2) Generate story JSON using that exact title
    const basePrompt = `
You must return ONLY a JSON object matching the provided schema (no prose, no backticks, no Markdown).

SCHEMA
{"title": "${storyTitle}", "story": string between ${minChars} and ${maxChars} characters}

IMPORTANT
- Use the title EXACTLY as provided: "${storyTitle}".
- Do not change, add punctuation to, or rephrase the title.

TASK
Write an original, high-quality short story based on the user's premise.

PREMISE
${prompt}

DURATION & LENGTH
Target spoken duration: ${duration} minutes.
Aim for ≈ ${targetChars} characters total (±10%). Keep pacing natural; avoid fluff.
(Important: stay within ${minChars}–${maxChars} characters.)

CONTENT & STYLE REQUIREMENTS
- Title: already chosen; do not modify.
- Story: plain text only; paragraphs separated by single blank lines; no chapter headings; no HTML/Markdown (asterisks for emphasis are allowed as cues).
- Structure: hook → rising tension → clear climax → satisfying resolution.
- Voice: show, don’t tell; vivid sensory detail; active voice; varied sentence rhythm.
- Scene/beat breaks for TTS: insert *** between beats roughly every 1–3k characters.
- Rating: PG-13 by default unless the premise requests otherwise.
- Originality: do NOT use copyrighted characters, settings, or lyrics unless supplied.
- Language: American English.

OUTPUT FORMAT
Return ONLY the JSON object with keys "title" and "story".
    `.trim();

    const initialText = await withRetry(async () => {
      const { text } = await generateText({
        model: openai("gpt-4o-mini"),
        prompt: basePrompt,
        maxOutputTokens: headroomTokens,
      });
      return text;
    }, "Initial story generation");

    // 3) Parse + validate JSON; enforce that title matches exactly
    let draft = StorySchema.parse(robustJsonParse<StoryResult>(initialText));
    draft.title = storyTitle; // force exact title even if model deviated slightly

    // 4) Guardrails: extend or tighten to meet char range using generateText only
    const enforceBounds = async (): Promise<void> => {
      let len = draft.story.length;

      // Too short → extend with NEW material only
      if (len < minChars) {
        const needed = minChars - len;
        const extendPrompt = `
Return ONLY the continuation text (no JSON, no title). Append NEW material only—no repetition—same voice and plot. 
Ensure that after appending, TOTAL length is at least ${minChars} characters (target ~${targetChars}). 
Preserve paragraphing and existing *** beat markers cadence.

[STORY SO FAR]
${draft.story}
        `.trim();

        const addendum = await withRetry(async () => {
          const { text } = await generateText({
            model: openai("gpt-4o-mini"),
            prompt: extendPrompt,
            maxOutputTokens: tokensForChars(needed + 600),
          });
          return text.trim();
        }, "Story extension");

        draft.story = (draft.story + "\n\n" + addendum).trim();
        len = draft.story.length;
      }

      // Too long → rewrite to target range
      if (len > maxChars) {
        const rewritePrompt = `
Rewrite the story below to ${targetChars} characters (±10%), preserving events, tone, and *** beat markers.
Reply ONLY with the rewritten story text (no JSON, no title).

[ORIGINAL]
${draft.story}
        `.trim();

        const rewritten = await withRetry(async () => {
          const { text } = await generateText({
            model: openai("gpt-4o-mini"),
            prompt: rewritePrompt,
            maxOutputTokens: tokensForChars(targetChars),
          });
          return text.trim();
        }, "Story tightening");

        draft.story = rewritten;
      }
    };

    await enforceBounds();

    // Final sanity pass: one more extend if short, clamp if long
    if (draft.story.length < minChars) {
      const needed = minChars - draft.story.length;
      const fallbackExtendPrompt = `
Return ONLY the continuation text (no JSON). New material, consistent voice/plot. 
After appending, total length must be ≥ ${minChars}. Avoid restating.

[STORY SO FAR]
${draft.story}
      `.trim();

      const addendum = await withRetry(async () => {
        const { text } = await generateText({
          model: openai("gpt-4o-mini"),
          prompt: fallbackExtendPrompt,
          maxOutputTokens: tokensForChars(needed + 600),
        });
        return text.trim();
      }, "Fallback story extension");

      draft.story = (draft.story + "\n\n" + addendum).trim();
    } else if (draft.story.length > maxChars) {
      draft.story = smartTrim(draft.story, maxChars);
    }

    // Re-validate and force exact title
    draft = StorySchema.parse(draft);
    draft.title = storyTitle;

    return draft;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`generateStory failed: ${msg}`);
  }
}
