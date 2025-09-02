import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

type StoryResult = { title: string; story: string };

/** Shared model */
const model = openai("gpt-4o-mini");

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

/** Escape for safe insertion into a RegExp */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove a leading title line if the model included it */
function stripLeadingTitle(body: string, title: string): string {
  let text = body.trimStart();
  const t = escapeRegExp(title.trim());

  // Place '-' first in character classes to avoid accidental ranges.
  const sepClass = "[-—–:·•.]";

  const patterns: RegExp[] = [
    // **Title** …
    new RegExp(`^\\*\\*\\s*${t}\\s*\\*\\*\\s*(?:${sepClass}\\s*)?`, "i"),
    // *Title* …
    new RegExp(`^\\*\\s*${t}\\s*\\*\\s*(?:${sepClass}\\s*)?`, "i"),
    // "Title" … or “Title” …
    new RegExp(`^[“"']\\s*${t}\\s*[”"']\\s*(?:${sepClass}\\s*)?`, "i"),
    // # Title \n
    new RegExp(`^#\\s*${t}\\s*\\n+`, "i"),
    // Title: … / Title — … / Title - …
    new RegExp(`^${t}\\s*(?:${sepClass}\\s*)+`, "i"),
    // Title on its own line, then a blank line
    new RegExp(`^${t}\\s*\\n\\s*\\n`, "i"),
  ];

  for (const rx of patterns) {
    if (rx.test(text)) return text.replace(rx, "").trimStart();
  }

  // Conservative fallback: if the very first line is exactly the title (optionally quoted), drop it
  const [firstLine, ...rest] = text.split(/\r?\n/);
  if (firstLine) {
    const fl = firstLine.replace(/^[“"']|[”"']$/g, "").trim();
    if (
      fl.localeCompare(title.trim(), undefined, { sensitivity: "accent" }) === 0
    ) {
      return rest.join("\n").trimStart();
    }
  }

  return body;
}

/** Ensure title meets length; if not, rewrite to ≤ 60 chars using generateText */
async function ensureTitleWithinLimit(title: string): Promise<string> {
  const cleaned = title.trim().replace(/^["'“”]+|["'“”]+$/g, "");
  if (cleaned.length <= 60 && cleaned.length >= 3) return cleaned;

  const { text } = await generateText({
    model,
    maxOutputTokens: 64,
    prompt: `
Rewrite this story title to be ≤ 60 characters, evocative, and spoiler-free.
Return ONLY the rewritten title text (no quotes, no JSON).

Original: ${cleaned}
    `.trim(),
  });

  const rewritten = text.trim().replace(/^["'“”]+|["'“”]+$/g, "");
  return rewritten.slice(0, 60).trim() || cleaned.slice(0, 60).trim();
}

/** Produce a title for the story (plain text only) */
async function createTitle(premise: string): Promise<string> {
  const rawTitle = await withRetry(async () => {
    const { text } = await generateText({
      model,
      temperature: 1,
      maxOutputTokens: 120,
      prompt: `
Create an evocative, spoiler-free title for a short story based on the user's premise.
Avoid copyrighted names unless supplied.
Return ONLY the title text (no quotes, no JSON), between 3 and 60 characters.

PREMISE
${premise}
      `.trim(),
    });
    return text;
  }, "Title generation");

  return ensureTitleWithinLimit(rawTitle);
}

/**
 * PURPOSE: Generate an original short story from a user premise.
 * - Step 1: Create a concise, evocative title (≤ 60 chars).
 * - Step 2: Generate plain-text story targeting a character range based on duration.
 * - Step 3: If needed, extend or tighten to stay within range.
 * Returns { title, story }.
 */
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
    const targetChars = Math.round(duration * 1000);
    const minChars = Math.max(500, Math.round(targetChars * 0.9));
    const maxChars = Math.round(targetChars * 1.1);
    const headroomTokens = tokensForChars(maxChars);

    // 1) Title (plain text)
    const storyTitle = await createTitle(prompt);

    // 2) Generate story (plain text only)
    const basePrompt = `
IMPORTANT
- Title of story: "${storyTitle}".
- Do not change, add punctuation to, or rephrase the title.
- Do NOT include the title anywhere in the story body.
- Begin directly with the first paragraph; no headings, no bolded title.

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
- Rating: PG-13 by default unless the premise requests otherwise.
- Originality: do NOT use copyrighted characters, settings, or lyrics unless supplied.
- Language: American English.
- Avoid overly stylized language such as stuttered phrases (e.g., "W-we seek the sea witch!") which may not convert well to TTS.

TIPS
- Punctuation matters! Exclamation points (!) for emphasis. Ellipsis (…) or dashes ( — ) for natural pauses.
- You can emphasize specific words by surrounding them with asterisks, e.g., *need*.

OUTPUT
Return ONLY the story text.
    `.trim();

    let story = await withRetry(async () => {
      const { text } = await generateText({
        model,
        temperature: 0.8,
        prompt: basePrompt,
        maxOutputTokens: headroomTokens,
      });
      return text.trim();
    }, "Initial story generation");

    // Strip any leading title the model may have printed
    story = stripLeadingTitle(story, storyTitle);

    // 3) Guardrails: extend or tighten to meet char range using plain text prompts only
    const enforceBounds = async (): Promise<void> => {
      let len = story.length;

      // Too short → extend with NEW material only
      if (len < minChars) {
        const needed = minChars - len;
        const extendPrompt = `
Return ONLY the continuation text. Append NEW material only—no repetition—same voice and plot.
Do NOT restate or include the title anywhere.
Ensure that after appending, TOTAL length is at least ${minChars} characters (target ~${targetChars}).
Preserve paragraphing and any existing *** beat markers cadence.

[STORY SO FAR]
${story}
        `.trim();

        const addendum = await withRetry(async () => {
          const { text } = await generateText({
            model,
            prompt: extendPrompt,
            maxOutputTokens: tokensForChars(needed + 600),
          });
          return text.trim();
        }, "Story extension");

        story = (story + "\n\n" + addendum).trim();
        story = stripLeadingTitle(story, storyTitle); // Safety: if the model re-added it
        len = story.length;
      }

      // Too long → rewrite to target range
      if (len > maxChars) {
        const rewritePrompt = `
Rewrite the story below to ${targetChars} characters (±10%), preserving events, tone, and any *** beat markers.
Do NOT include or reinsert the title.
Reply ONLY with the rewritten story text.

[ORIGINAL]
${story}
        `.trim();

        story = await withRetry(async () => {
          const { text } = await generateText({
            model,
            prompt: rewritePrompt,
            maxOutputTokens: tokensForChars(targetChars),
          });
          return text.trim();
        }, "Story tightening");

        story = stripLeadingTitle(story, storyTitle);
      }
    };

    await enforceBounds();

    // Final sanity pass: one more extend if short, clamp if long
    if (story.length < minChars) {
      const needed = minChars - story.length;
      const fallbackExtendPrompt = `
Return ONLY the continuation text. New material, consistent voice/plot.
Do NOT include the title.
After appending, total length must be ≥ ${minChars}. Avoid restating.

[STORY SO FAR]
${story}
      `.trim();

      const addendum = await withRetry(async () => {
        const { text } = await generateText({
          model,
          prompt: fallbackExtendPrompt,
          maxOutputTokens: tokensForChars(needed + 600),
        });
        return text.trim();
      }, "Fallback story extension");

      story = (story + "\n\n" + addendum).trim();
      story = stripLeadingTitle(story, storyTitle);
    } else if (story.length > maxChars) {
      story = smartTrim(story, maxChars);
    }

    // Return the final result (plain text fields)
    story = stripLeadingTitle(story, storyTitle); // Final guard, no-ops if clean
    return { title: storyTitle, story };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`generateStory failed: ${msg}`);
  }
}
