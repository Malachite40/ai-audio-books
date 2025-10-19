"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ConfirmAudioVisibility } from "@/components/confirm-audio-visibility";
import { LoginRequiredDialog } from "@/components/login-required-modal";
import { NotEnoughCreditsDialog } from "@/components/not-enough-credits-modal";
import { authClient } from "@/lib/auth-client";
import { api } from "@/trpc/react";
import { Speaker } from "@workspace/database";
import { Languages, sectionType } from "@workspace/trpc/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { Settings2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/* -----------------------------------------------------
   Types & Schema
----------------------------------------------------- */
export type AdvancedAudioFormProps = {
  speakers: Speaker[];
};

const Schema = z.object({
  name: z.string().min(2).max(100),
  speakerId: z.string().uuid({ message: "Please select a speaker." }),
  text: z.string().min(1, "Please paste some text."),
});

type NormalizeOptions = {
  asciiQuotes?: boolean;
  collapseDashes?: boolean;
  normalizeEllipsis?: boolean;
  normalizeNbsp?: boolean;
  stripZeroWidth?: boolean;
  stripControl?: boolean;
  tabsToSpace?: boolean;
  collapseSpaces?: boolean;
  collapseBlankLines?: boolean;
  trim?: boolean;
};

const defaultNormalizeOptions: Required<NormalizeOptions> = {
  asciiQuotes: true,
  collapseDashes: true,
  normalizeEllipsis: true,
  normalizeNbsp: true,
  stripZeroWidth: true,
  stripControl: true,
  tabsToSpace: true,
  collapseSpaces: true,
  collapseBlankLines: true,
  trim: true,
};

const RE = {
  zeroWidth: /[\u200B\u200C\u200D\u2060\uFEFF]/g,
  control: /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g,
  crlf: /\r\n?/g,
  nbsp: /\u00A0/g,
  tabs: /\t/g,
  multiSpace: /[ ]{2,}/g,
  multiBlankLines: /\n{3,}/g,
  leadingBlank: /^(?:\s*\n)+/g,
  trailingBlank: /(?:\n\s*)+$/g,
};

function normalizeForTTS(text: string, options?: NormalizeOptions) {
  const opts = { ...defaultNormalizeOptions, ...options };
  let t = (text || "").normalize("NFKC");

  if (opts.normalizeEllipsis) t = t.replace(/\u2026/g, "...");
  if (opts.collapseDashes) t = t.replace(/[\u2014\u2013]/g, "-");
  if (opts.asciiQuotes)
    t = t
      .replace(/[\u2018\u2019\u2032\u02BC]/g, "'")
      .replace(/[\u201C\u201D\u2033]/g, '"');

  t = t.replace(RE.crlf, "\n");
  if (opts.stripZeroWidth) t = t.replace(RE.zeroWidth, "");
  if (opts.stripControl) t = t.replace(RE.control, "");
  if (opts.normalizeNbsp) t = t.replace(RE.nbsp, " ");
  if (opts.tabsToSpace) t = t.replace(RE.tabs, " ");

  if (opts.collapseSpaces) {
    t = t
      .split("\n")
      .map((line) => line.replace(RE.multiSpace, " "))
      .join("\n");
  }
  if (opts.collapseBlankLines) t = t.replace(RE.multiBlankLines, "\n\n");
  if (opts.trim)
    t = t.replace(RE.leadingBlank, "").replace(RE.trailingBlank, "").trim();
  return t;
}

/* -----------------------------------------------------
   Chapter detection (handles inline headers)
----------------------------------------------------- */

type Chapter = {
  index: number;
  title: string;
  type: z.infer<typeof sectionType>;
  startLine: number;
  endLine: number;
  preview: string;
  body: string;
};

function toTitleCaseSafe(s: string) {
  return s.replace(
    /\b([A-Za-z][a-z']*)\b/g,
    (m) => m[0]!.toUpperCase() + m.slice(1).toLowerCase()
  );
}

type HeaderHit = { ok: boolean; strength: number; normalized: string };

function classifyHeaderType(header: string): Chapter["type"] {
  const h = header.trim().toLowerCase();
  if (/^chapter\b/.test(h)) return "chapter";
  if (/^prolog(?:ue)?\b/.test(h)) return "prologue";
  if (/^epilog(?:ue)?\b/.test(h)) return "epilogue";
  if (/^preface\b/.test(h)) return "preface";
  if (/^foreword\b/.test(h)) return "foreword";
  if (/^part\b/.test(h)) return "part";
  if (/^book\b/.test(h)) return "book";
  if (/^scene break\b/.test(h)) return "scene";
  if (/^\d+(?:\.\d+)+\b/.test(h)) return "section";
  return "other";
}

const RE_CHAPTER_STRONG = [
  /^(?:chapter|cap[ií]tulo|kapitel|chapitre|capitolo)\s+[ivxlcdm\d]+\b(?:\s*[-–—:]\s*\S.*)?$/i,
  /^(?:part|book)\s+[ivxlcdm\d]+\b(?:\s*[-–—:]\s*\S.*)?$/i,
  /^(?:prologue|epilogue|preface|foreword|epilog)\b(?:\s*[-–—:]\s*\S.*)?$/i,
  /^\d+(?:\.\d+)+\s*[-–—:]?\s+\S.+$/,
];

const RE_CHAPTER_WEAK = [
  /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*\b\d{4}\b/i,
  /^(?:\*{3,}|[-–—]{3,}|#{3,})\s*$/,
];

function fixInlineArtifacts(line: string): string {
  let s = line;
  s = s.replace(/([A-Za-z])(\d{1,2}:\d{2}\s?(?:AM|PM))/gi, "$1 $2");
  s = s.replace(/([A-Za-z])(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/g, "$1 $2");
  s = s.replace(/\b(\d{1,2}:\d{2}\s?(?:AM|PM))([A-Za-z]{1,3})\b/gi, "$1 $2");
  return s;
}

function headerStrength(rawLine: string): HeaderHit {
  const line = fixInlineArtifacts(rawLine.trim());
  if (!line) return { ok: false, strength: 0, normalized: "" };
  if (line.length > 160) return { ok: false, strength: 0, normalized: "" };

  for (const re of RE_CHAPTER_STRONG) {
    if (re.test(line)) {
      const m = line.match(
        /^(?<head>(?:chapter|part|book)\s+[ivxlcdm\d]+)\b(?:\s*[-–—:]\s*(?<title>.+))?$/i
      );
      if (m?.groups) {
        const { head, title } = m.groups as any;
        const norm = title
          ? `${toTitleCaseSafe(head)} — ${toTitleCaseSafe(title)}`
          : toTitleCaseSafe(head);
        return { ok: true, strength: 0.9, normalized: norm };
      }
      return { ok: true, strength: 0.9, normalized: toTitleCaseSafe(line) };
    }
  }

  if (RE_CHAPTER_WEAK.some((re) => re.test(line))) {
    return { ok: true, strength: 0.6, normalized: toTitleCaseSafe(line) };
  }

  return { ok: false, strength: 0, normalized: "" };
}

function snapToBlank(lines: string[], i: number, up = 2): number {
  for (let k = 0; k <= up; k++) {
    const j = i - k;
    if (j >= 0 && (j === 0 || lines[j - 1]!.trim() === "")) return j;
  }
  return i;
}

function extractChapters(normalized: string): {
  title: string;
  chapters: Chapter[];
} {
  const lines = normalized.split("\n");
  const STRONG_OK = 0.8;
  const WEAK_OK = 0.6;

  const candidates: { i: number; strength: number; header: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const prevBlank = i === 0 || lines[i - 1]!.trim() === "";
    const nextBlank = i + 1 >= lines.length || lines[i + 1]!.trim() === "";

    const hit = headerStrength(lines[i]!);
    if (!hit.ok) continue;

    if (
      hit.strength >= STRONG_OK ||
      (hit.strength >= WEAK_OK && (prevBlank || nextBlank))
    ) {
      candidates.push({
        i,
        strength: hit.strength,
        header: hit.normalized || lines[i]!.trim(),
      });
    }
  }

  candidates.sort((a, b) => a.i - b.i || b.strength - a.strength);

  const kept: { i: number; h: number; strength: number; header: string }[] = [];
  let lastLine = -1;
  for (const c of candidates) {
    if (c.i === lastLine) continue;
    const j = snapToBlank(lines, c.i, 2);
    kept.push({ ...c, i: j, h: c.i });
    lastLine = c.i;
  }

  const chaptersBase: Array<
    Pick<Chapter, "index" | "title" | "type" | "startLine" | "preview"> & {
      headerLine: number; // original header line index; -1 if synthetic
    }
  > = [];
  if (kept.length === 0) {
    const firstNonEmpty = lines.find((l) => (l ?? "").trim())?.trim() ?? "";
    chaptersBase.push({
      index: 1,
      title: "Chapter 1",
      type: "chapter",
      startLine: 0,
      preview: firstNonEmpty,
      headerLine: -1,
    });
  } else {
    kept.forEach((k, n) => {
      let preview = "";
      // Prefer preview after the actual header line `k.h`
      for (let j = k.h + 1; j < Math.min(lines.length, k.h + 12); j++) {
        const t = lines[j]!.trim();
        if (!t) continue;
        const nextHit = headerStrength(t);
        if (nextHit.ok && nextHit.strength >= WEAK_OK) continue; // skip header-like lines
        preview = t;
        break;
      }
      const normalizedTitle = k.header.replace(/^(\*|#|\-)+$/g, "Scene Break");
      chaptersBase.push({
        index: n + 1,
        title: normalizedTitle,
        type: classifyHeaderType(normalizedTitle),
        startLine: k.i,
        preview,
        headerLine: k.h,
      });
    });
  }

  // Enrich with endLine and body (excluding the header line when detected)
  const chapters: Chapter[] = chaptersBase.map((c, i) => {
    const endLine =
      i + 1 < chaptersBase.length
        ? chaptersBase[i + 1]!.startLine
        : lines.length;
    // Start body after the original header line, if present;
    // otherwise, at the first non-empty content line.
    let bodyStart = c.headerLine >= 0 ? c.headerLine + 1 : c.startLine;
    // Advance past blank lines
    while (bodyStart < endLine && (lines[bodyStart] ?? "").trim() === "") {
      bodyStart++;
    }
    // If multiple header-like lines stack (e.g., *** then Chapter 1), skip them all
    while (bodyStart < endLine) {
      const t = (lines[bodyStart] ?? "").trim();
      if (!t) {
        bodyStart++;
        continue;
      }
      const hit = headerStrength(t);
      if (hit.ok && hit.strength >= WEAK_OK) {
        bodyStart++;
        continue;
      }
      break;
    }
    const body = lines.slice(bodyStart, endLine).join("\n").trim();
    return { ...c, endLine, body };
  });

  const titleCandidate =
    chapters[0]?.title &&
    /chapter|prologue|part|book|scene/i.test(chapters[0]!.title)
      ? chapters[0]!.title
      : (lines[0]?.trim() ?? "Untitled Audio");
  const title = toTitleCaseSafe(titleCandidate);
  return { title, chapters };
}

/* -----------------------------------------------------
   Helpers
----------------------------------------------------- */
const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const estReadMin = (s: string) => Math.max(1, Math.round(countWords(s) / 200));

/* -----------------------------------------------------
   Component (Overhauled)
----------------------------------------------------- */
export function AdvancedAudioForm({ speakers }: AdvancedAudioFormProps) {
  const router = useRouter();
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: "",
      speakerId: speakers?.[0]?.id ?? "",
      text: "",
    },
    mode: "onChange",
  });
  const { data: userData } = authClient.useSession();
  const isLoggedIn = !!userData?.session;
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [normOpts, setNormOpts] = useState<Required<NormalizeOptions>>(
    defaultNormalizeOptions
  );

  const rawText = form.watch("text") ?? "";
  const selectedSpeakerId = form.watch("speakerId") ?? "";

  // Language handling (mirror new.audio.client.tsx behavior)
  const initialLanguage: (typeof Languages)[number] = useMemo(() => {
    const fromSpeaker = speakers.find((s) => s.id === selectedSpeakerId)
      ?.language as unknown as string | undefined;
    const fallback = (speakers?.[0]?.language as any) ?? Languages[0];
    const pick = fromSpeaker ?? fallback;
    return (Languages as readonly string[]).includes(pick)
      ? (pick as (typeof Languages)[number])
      : Languages[0];
  }, [speakers, selectedSpeakerId]);

  const [languageFilter, setLanguageFilter] =
    useState<(typeof Languages)[number]>(initialLanguage);

  const filteredSpeakers = useMemo(() => {
    const list = Array.isArray(speakers) ? speakers : [];
    return list.filter(
      (s) => (s as any).language === (languageFilter as unknown as string)
    );
  }, [speakers, languageFilter]);

  // Ensure selected speaker exists in filtered list; default to first available
  useEffect(() => {
    if (!selectedSpeakerId) return;
    const inOptions = filteredSpeakers.some((s) => s.id === selectedSpeakerId);
    if (!inOptions && filteredSpeakers[0]) {
      form.setValue("speakerId", filteredSpeakers[0].id, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [filteredSpeakers, selectedSpeakerId, form]);

  const [normalized, setNormalized] = useState("");

  // Debounced normalization
  useEffect(() => {
    const id = setTimeout(
      () => setNormalized(normalizeForTTS(rawText, normOpts)),
      120
    );
    return () => clearTimeout(id);
  }, [rawText, normOpts]);

  const { chapters } = useMemo(() => extractChapters(normalized), [normalized]);
  const chapterBlocks = useMemo(
    () =>
      chapters.map((c) => {
        const content = c.body;
        const words = countWords(content);
        const readMin = estReadMin(content);
        return { ...c, content, words, readMin };
      }),
    [chapters]
  );
  // Speaker selected; can be used for future features

  // Chapters are display-only; no active selection or scroll tracking

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        navigator.clipboard.writeText(normalized).catch(() => {});
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [normalized, chapters.length]);

  const creditsQuery = api.credits.fetch.useQuery();

  const availableCredits = userData
    ? (creditsQuery.data?.credits?.amount ?? 0)
    : 9999999999;
  const requiredCredits = form.watch("text").length;
  const overCharacterLimit = requiredCredits > availableCredits;

  const stats = useMemo(
    () => ({
      chars: normalized.length,
      words: countWords(normalized),
      chapters: chapters.length,
      readMin: estReadMin(normalized),
    }),
    [normalized, chapters.length]
  );

  const createAudioFile = api.audio.inworld.createFromChapters.useMutation({
    onSuccess: (data) => {
      router.push(`/audio-file/${data.audioFile.id}`);
    },
    onError: (error) => {
      console.error("Error creating audio file:", error);
      toast("Error", {
        description: error.message,
        duration: 6000,
      });
    },
  });

  /* -----------------------------------------------------
     UI
  ----------------------------------------------------- */
  return (
    <>
      {/* Popups */}
      <LoginRequiredDialog open={showLogin} onOpenChange={setShowLogin} />
      <NotEnoughCreditsDialog
        open={showCredits}
        onOpenChange={setShowCredits}
        needed={requiredCredits}
        available={availableCredits}
      />
      {/* Visibility confirmation */}
      <ConfirmAudioVisibility
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onCancel={async () => {}}
        onConfirm={async ({ isPublic }) => {
          const vals = form.getValues();
          const finalName = (vals.name && vals.name.trim()) || "Untitled Audio";

          createAudioFile.mutate({
            ...vals,
            name: finalName,
            public: !!isPublic,
            chapters: chapters.map((chapter) => ({
              text: chapter.body,
              type: chapter.type,
              title: chapter.title,
            })),
            speakerId: vals.speakerId,
            text: vals.text,
          });
        }}
      />
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col gap-2 rounded-xl border bg-background/80 p-2 supports-[backdrop-filter]:bg-background/60 backdrop-blur md:flex-row md:items-center">
          <div className="min-w-0 flex items-center gap-2 text-xs sm:text-sm overflow-x-auto whitespace-nowrap pr-1">
            <Wand2 className="h-4 w-4" />
            <span className="font-medium">Advanced Tools</span>
            <span className="mx-1 text-muted-foreground hidden sm:inline">
              •
            </span>
            <span className="text-muted-foreground">
              {stats.words.toLocaleString()} words
            </span>
            <span className="mx-1 text-muted-foreground hidden sm:inline">
              •
            </span>
            <span className="text-muted-foreground">
              ~{stats.readMin} min read
            </span>
            <span className="mx-1 text-muted-foreground hidden sm:inline">
              •
            </span>
            <span className="text-muted-foreground">
              {stats.chapters} chapters
            </span>
          </div>
          <div className="md:ml-auto flex flex-wrap gap-2 w-full md:w-auto justify-start md:justify-end">
            <Button
              onClick={() => {
                setShowConfirm(true);
              }}
            >
              Create
            </Button>
          </div>
        </div>

        {/* Input */}
        <Form {...form}>
          <form
            className="grid grid-cols-1 gap-4 lg:grid-cols-12"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {/* Left: Controls */}
            <div className="space-y-4 lg:col-span-4">
              {/* Language */}
              <div className="flex flex-col gap-2">
                <FormLabel>Language</FormLabel>
                <Select
                  value={languageFilter}
                  onValueChange={(v) => {
                    setLanguageFilter(v as (typeof Languages)[number]);
                    const match = speakers.find((s) => s.language === v);
                    if (match) {
                      form.setValue("speakerId", match.id, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                >
                  <SelectTrigger
                    value={languageFilter}
                    className="capitalize w-full"
                  >
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {Languages.map((lang) => (
                      <SelectItem
                        className="capitalize"
                        key={lang}
                        value={lang}
                      >
                        {lang.toLocaleLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Speaker (filtered by language) */}
              <FormField
                control={form.control}
                name="speakerId"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Speaker</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) => field.onChange(v)}
                        disabled={filteredSpeakers.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              filteredSpeakers.length === 0
                                ? "No speakers in this language"
                                : "Select a speaker"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredSpeakers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {(s as any).displayName ?? s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {fieldState.error && <FormMessage />}
                  </FormItem>
                )}
              />

              {/* Normalization (Dropdown) */}
              <div className="rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Settings2 className="h-4 w-4" /> Normalization
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label="Normalization options"
                        className="h-7 px-2 text-xs"
                      >
                        Options
                        <Badge variant="secondary" className="ml-2 px-1.5 py-0">
                          {Object.values(normOpts).filter(Boolean).length}
                        </Badge>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuCheckboxItem
                        checked={normOpts.asciiQuotes}
                        onCheckedChange={(v) =>
                          setNormOpts({ ...normOpts, asciiQuotes: Boolean(v) })
                        }
                      >
                        ASCII quotes
                      </DropdownMenuCheckboxItem>

                      <DropdownMenuCheckboxItem
                        checked={normOpts.collapseDashes}
                        onCheckedChange={(v) =>
                          setNormOpts({
                            ...normOpts,
                            collapseDashes: Boolean(v),
                          })
                        }
                      >
                        Collapse em/en dashes
                      </DropdownMenuCheckboxItem>

                      <DropdownMenuCheckboxItem
                        checked={normOpts.normalizeEllipsis}
                        onCheckedChange={(v) =>
                          setNormOpts({
                            ...normOpts,
                            normalizeEllipsis: Boolean(v),
                          })
                        }
                      >
                        Normalize ellipsis
                      </DropdownMenuCheckboxItem>

                      <DropdownMenuCheckboxItem
                        checked={
                          normOpts.collapseSpaces && normOpts.collapseBlankLines
                        }
                        onCheckedChange={(v) =>
                          setNormOpts({
                            ...normOpts,
                            collapseSpaces: Boolean(v),
                            collapseBlankLines: Boolean(v),
                          })
                        }
                      >
                        Collapse spaces & blank lines
                      </DropdownMenuCheckboxItem>

                      <DropdownMenuCheckboxItem
                        checked={
                          normOpts.stripZeroWidth && normOpts.stripControl
                        }
                        onCheckedChange={(v) =>
                          setNormOpts({
                            ...normOpts,
                            stripZeroWidth: Boolean(v),
                            stripControl: Boolean(v),
                          })
                        }
                      >
                        Strip zero-width & control
                      </DropdownMenuCheckboxItem>

                      <DropdownMenuCheckboxItem
                        checked={normOpts.tabsToSpace && normOpts.normalizeNbsp}
                        onCheckedChange={(v) =>
                          setNormOpts({
                            ...normOpts,
                            tabsToSpace: Boolean(v),
                            normalizeNbsp: Boolean(v),
                          })
                        }
                      >
                        Tabs → spaces & NBSP → space
                      </DropdownMenuCheckboxItem>

                      <DropdownMenuCheckboxItem
                        checked={normOpts.trim}
                        onCheckedChange={(v) =>
                          setNormOpts({ ...normOpts, trim: Boolean(v) })
                        }
                      >
                        Trim
                      </DropdownMenuCheckboxItem>

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setNormOpts(defaultNormalizeOptions)}
                      >
                        Reset defaults
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Chapters (improved layout) */}
              <Card className="p-3 gap-2">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">Chapters</div>
                  <Badge variant="secondary" className="px-2 py-0 text-xs">
                    {chapters.length}
                  </Badge>
                </div>
                {!normalized ? (
                  <div className="text-sm text-muted-foreground">
                    No text yet.
                  </div>
                ) : chapters.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No chapters detected.
                  </div>
                ) : (
                  <ScrollArea className="h-72 overflow-x-hidden">
                    {/* This wrapper neutralizes the display:table/min-width:100% sizing */}
                    <div className="w-full min-w-0">
                      <Accordion
                        type="single"
                        collapsible
                        className="pr-2 w-full"
                      >
                        {chapterBlocks.map((c) => (
                          <AccordionItem
                            key={`${c.startLine}-${c.index}`}
                            value={`c-${c.index}`}
                          >
                            <AccordionTrigger className="w-full overflow-hidden py-2 hover:no-underline">
                              <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                <div className="flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium text-muted-foreground">
                                  {c.index}
                                </div>

                                {/* make this column shrinkable */}
                                <div className="flex min-w-0 basis-0 flex-1 flex-col">
                                  {/* actual truncation target */}
                                  <div className="truncate text-sm font-medium max-w-full">
                                    {c.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {c.words.toLocaleString()} words • ~
                                    {c.readMin} min
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>

                            <AccordionContent className="pb-3">
                              {c.body ? (
                                <div className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                                  {c.body}
                                </div>
                              ) : null}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  </ScrollArea>
                )}
              </Card>
            </div>

            {/* Right: Title and Textarea */}
            <div className="lg:col-span-8">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className={cn("mb-4 md:max-w-96")}>
                    <FormLabel>
                      Title
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., My Morning Affirmations"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="text"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Raw Text</FormLabel>
                    <FormControl>
                      <InputGroup>
                        <InputGroupTextarea
                          className="h-[70vh] max-h-[70vh]"
                          rows={10}
                          placeholder="Paste your chaptered text here…"
                          {...field}
                          value={field.value ?? ""}
                          aria-label="Raw text input"
                        />

                        {/* Add-on with your credit/loader text */}
                        <InputGroupAddon align="block-end">
                          {/* Keep it tiny + responsive like your original (hidden on mobile) */}
                          <div
                            className="flex gap-2 items-end justify-end"
                            aria-live="polite"
                          >
                            {(requiredCredits > 0 ||
                              creditsQuery.data?.credits) && (
                              <InputGroupText
                                className={cn(
                                  "text-xs ml-auto",
                                  overCharacterLimit
                                    ? "text-amber-600"
                                    : "text-muted-foreground"
                                )}
                              >
                                {requiredCredits > 0
                                  ? `${requiredCredits} Credits - $${(
                                      (requiredCredits * 10) /
                                      1_000_000
                                    ).toFixed(4)}`
                                  : "0"}
                                {typeof availableCredits === "number" &&
                                  isLoggedIn &&
                                  ` |  Remaining Credits: ${availableCredits}`}
                              </InputGroupText>
                            )}
                          </div>
                        </InputGroupAddon>
                      </InputGroup>
                    </FormControl>
                    {fieldState.error && <FormMessage />}
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </div>
    </>
  );
}

export default AdvancedAudioForm;
