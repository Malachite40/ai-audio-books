// app/(whatever)/new-audio-client.tsx
"use client";

import { ConfirmAudioVisibility } from "@/components/confirm-audio-visibility";
import ExampleAudioToggle from "@/components/example-audio-toggle";
import { LoginRequiredDialog } from "@/components/login-required-modal";
import { NotEnoughCreditsDialog } from "@/components/not-enough-credits-modal";
import { authClient } from "@/lib/auth-client";
import { useNewAudioFormStore } from "@/store/use-new-audio-form-store";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Speaker } from "@workspace/database";
import { Languages } from "@workspace/trpc/client";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Slider } from "@workspace/ui/components/slider";
import { cn } from "@workspace/ui/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  AudioLinesIcon,
  BookOpen,
  ClipboardList,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AdvancedAudioForm } from "../_components/advanced-audio-form";
// ------------------------------
// Helpers for duration UX
// ------------------------------
const MIN_DURATION = 5; // minutes
const MAX_DURATION = 60; // minutes
const STEP_MINUTES = 5; // slider/input increments

function clamp(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), hi);
}

function roundToStep(n: number, step = STEP_MINUTES) {
  return Math.round(n / step) * step;
}

function clampAndStep(n: number) {
  return clamp(roundToStep(n), MIN_DURATION, MAX_DURATION);
}

function formatHm(minutes?: number) {
  if (!Number.isFinite(minutes)) return "—";
  const m = Math.max(0, Math.floor(Number(minutes)));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0 && r > 0) return `${h}h ${r}min`;
  if (h > 0) return `${h}h`;
  return `${r}min`;
}

// --- Schema (name now optional) ---
const FormSchema = z.object({
  name: z.string().trim().max(100).optional(),
  speakerId: z.string().uuid({ message: "Please select a speaker." }),
  text: z.string().min(1, "Please enter text to synthesize."),
  durationMinutes: z.number().optional(),
  public: z.boolean(),
});

// --- RoyalRoad helpers (client-only import flow) ---
const ROYALROAD_CHAPTER_RE =
  /^https?:\/\/(?:www\.)?royalroad\.com\/fiction\/(\d+)\/([^/]+)\/chapter\/(\d+)(?:\/([^/]+))?\/?$/i;

const extractRoyalRoadUrl = (s: string) => s.match(ROYALROAD_CHAPTER_RE)?.[0];

const toTitle = (s: string) =>
  s
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const buildNameFromUrl = (url: string) => {
  const m = url.match(ROYALROAD_CHAPTER_RE);
  if (!m) return "RoyalRoad Chapter";
  const [, , fictionSlug, , chapterSlug] = m as unknown as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (!fictionSlug) return "RoyalRoad Chapter";
  const fiction = toTitle(fictionSlug);
  const chap = chapterSlug ? toTitle(chapterSlug) : undefined;
  return chap ? `${fiction} — ${chap}` : `${fiction} — Chapter`;
};

// NOTE: For a pure client-side approach (no server route), we use a
// CORS-friendly readability proxy. For production, consider hosting
// your own lightweight proxy to reduce external dependency.
const READABILITY_PROXY_PREFIX = "https://r.jina.ai/http://";
const toProxyUrl = (targetUrl: string) =>
  READABILITY_PROXY_PREFIX + targetUrl.replace(/^https?:\/\//i, "");

// --- Title suggestion + slug helpers ---
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const NewAudioClient = ({ speakers }: { speakers: Speaker[] }) => {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const {
    setText,
    hasHydrated,
    text,
    setSpeakerId,
    speakerId,
    setDurationMinutes,
    durationMinutes: storeDurationMinutes,
    name: storeName,
    setName: setStoreName,
    // Persisted language selection
    language: storedLanguage,
    setLanguage: setStoredLanguage,
    reset: resetStore,
  } = useNewAudioFormStore();

  // STEP state in URL via nuqs
  const [mode, setMode] = useQueryState(
    "mode",
    parseAsString.withDefault("").withOptions({})
  );

  const modeTextConfig = useMemo(
    () => ({
      copy: {
        label: "Text",
        placeholder: "Once upon a time...",
      },
      "royal-road": {
        label: "RoyalRoad URL",
        placeholder: "Paste a RoyalRoad chapter URL",
      },
      ai: {
        label: "Prompt",
        placeholder: "What would you like your story to be about?",
      },
      default: {
        label: "Prompt",
        placeholder: "What would you like your story to be about?",
      },
    }),
    []
  );

  // Auth state
  const { data: userData } = authClient.useSession();
  const isLoggedIn = !!userData?.session;
  const isAdmin = userData?.user.role === "admin";

  // Admin test audio mutation
  const testAudioMutation = api.audio.test.create.useMutation({
    onSuccess: (data) => {
      router.push(`/audio-file/${data.audioFile.id}`);
    },
    onError: (error) => {
      toast("Test audio creation failed", {
        description: error.message,
        duration: 4000,
      });
    },
  });

  // Queries
  const creditsQuery = api.credits.fetch.useQuery();

  const initialLanguage: (typeof Languages)[number] = useMemo(() => {
    // 1) Prefer persisted store language if valid
    const fromStore = storedLanguage as unknown as string | undefined;
    if (fromStore && (Languages as readonly string[]).includes(fromStore)) {
      return fromStore as (typeof Languages)[number];
    }

    // 2) Otherwise, if we already have a persisted speaker, use its language
    const fromSpeaker = speakers.find((s) => s.id === speakerId)
      ?.language as unknown as string | undefined;
    if (fromSpeaker && (Languages as readonly string[]).includes(fromSpeaker)) {
      return fromSpeaker as (typeof Languages)[number];
    }

    // 3) Fallback to first speaker language or first Languages entry
    const fallback = (speakers?.[0]?.language as any) ?? Languages[0];
    return (Languages as readonly string[]).includes(fallback)
      ? (fallback as (typeof Languages)[number])
      : Languages[0];
  }, [speakers, speakerId, storedLanguage]);

  const [languageFilter, setLanguageFilter] =
    useState<(typeof Languages)[number]>(initialLanguage);

  // Keep local language filter in sync with persisted language when it rehydrates/changes
  useEffect(() => {
    const lang = storedLanguage as unknown as string | undefined;
    if (
      lang &&
      (Languages as readonly string[]).includes(lang) &&
      lang !== languageFilter
    ) {
      setLanguageFilter(lang as (typeof Languages)[number]);
    }
  }, [storedLanguage]);

  // Speakers filtered by the chosen language
  const filteredSpeakers = useMemo(() => {
    const list = Array.isArray(speakers) ? speakers : [];
    return list.filter(
      (s) => (s as any).language === (languageFilter as unknown as string)
    );
  }, [speakers, languageFilter]);

  // Persist language selection to store when it changes
  useEffect(() => {
    if (languageFilter && languageFilter !== storedLanguage) {
      setStoredLanguage(languageFilter as unknown as string);
    }
  }, [languageFilter, storedLanguage]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      text: text || "",
      public: false,
      speakerId: speakerId || speakers?.[0]?.id,
      durationMinutes: storeDurationMinutes ?? 5,
    },
    mode: "onChange",
  });

  // Sync form values to store on change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "text" && typeof value.text === "string") {
        setText(value.text);
      }
      if (name === "name") {
        setStoreName(value.name ?? "");
      }
      if (
        name === "durationMinutes" &&
        typeof value.durationMinutes === "number"
      ) {
        setDurationMinutes(value.durationMinutes);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, setText, setSpeakerId, setDurationMinutes, setStoreName]);

  // Restore from store on mount
  useEffect(() => {
    if (!hasHydrated) return;
    if (text && text !== form.getValues("text")) {
      form.setValue("text", text, { shouldDirty: false });
      form.trigger("text");
    }
    if (storeName && storeName !== form.getValues("name")) {
      form.setValue("name", storeName, { shouldDirty: false });
      form.trigger("name");
    }
    if (
      typeof storeDurationMinutes === "number" &&
      storeDurationMinutes !== form.getValues("durationMinutes")
    ) {
      form.setValue("durationMinutes", storeDurationMinutes, {
        shouldDirty: false,
      });
      form.trigger("durationMinutes");
    }
  }, [text, storeName, speakerId, storeDurationMinutes, storedLanguage]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!speakerId) return;

    const speaker = speakers.find((s) => s.id === speakerId);
    if (!speaker) return;

    // 1) ensure language matches the speaker's language
    if (speaker.language !== languageFilter) {
      setLanguageFilter(speaker.language as (typeof Languages)[number]);
      return; // wait for next render where filteredSpeakers is correct
    }

    // 2) only set the field once the options include the value
    const inOptions = filteredSpeakers.some((s) => s.id === speakerId);
    if (inOptions && form.getValues("speakerId") !== speakerId) {
      form.setValue("speakerId", speakerId, { shouldDirty: false });
      form.trigger("speakerId");
    }
  }, [
    hasHydrated,
    speakerId,
    speakers,
    languageFilter,
    filteredSpeakers,
    form,
  ]);

  const createAudioFile = api.audio.inworld.createFromCopy.useMutation({
    onSuccess: (data) => {
      router.push(`/audio-file/${data.audioFile.id}`);
      resetStore();
    },
    onError: (error) => {
      console.error("Error creating audio file:", error);
      toast("Error", {
        description: error.message,
        duration: 6000,
      });
    },
  });

  const createAudioFileFromAi = api.audio.inworld.createFromAi.useMutation({
    onSuccess: (data) => {
      router.push(`/audio-file/${data.audioFile.id}`);
      resetStore();
    },
    onError: (error) => {
      console.error("Error creating audio file:", error);
      toast("Error", {
        description: error.message,
        duration: 6000,
      });
    },
  });

  // Derived values
  const selectedSpeakerId = form.watch("speakerId");
  const currentSpeaker = filteredSpeakers.find(
    (s) => s.id === selectedSpeakerId
  );
  const exampleUrl =
    typeof currentSpeaker?.exampleAudio === "string" &&
    currentSpeaker.exampleAudio.length > 0
      ? currentSpeaker.exampleAudio
      : undefined;

  const nameValue = form.watch("name") ?? "";
  const textValue = form.watch("text") ?? "";

  const suggestedTitle = nameValue.trim().length > 0 ? "" : "Untitled Audio";

  const slugPreview = slugify((nameValue || suggestedTitle || "audio").trim());

  // Credits calculation: if AI mode, use durationMinutes * 1000; else text length
  const durationMinutes = form.watch("durationMinutes") ?? 0;
  const requiredCredits =
    mode === "ai" ? durationMinutes * 1000 : textValue.length;
  const availableCredits = userData
    ? (creditsQuery.data?.credits?.amount ?? 0)
    : 9999999999;
  const overCharacterLimit = requiredCredits > availableCredits;

  // Clicking Create Audio:
  const handleCreateClick = async () => {
    const valid = await form.trigger();
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    if (!valid) return;
    if (overCharacterLimit) {
      setShowCredits(true);
      return;
    }
    setShowConfirm(true);
  };

  // --- RoyalRoad import state  logic ---
  const [isImportingRR, setIsImportingRR] = useState(false);

  const importRoyalRoadChapter = async (url: string) => {
    if (isImportingRR) return;
    setIsImportingRR(true);
    toast("Fetching RoyalRoad chapter…");

    try {
      const proxied = toProxyUrl(url);
      const res = await fetch(proxied, { credentials: "omit" });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

      let body = await res.text();
      const text = body
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<\/?(?:\w+)[^>]*>/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/^Title:.*$/gm, "")
        .replace(/^URL Source:.*$/gm, "")
        .replace(/^Markdown Content:.*$/gm, "")
        .trim();

      if (!text) throw new Error("No content found");

      form.setValue("name", buildNameFromUrl(url), {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("text", text, {
        shouldDirty: true,
        shouldValidate: true,
      });

      toast("Chapter imported", {
        description: `${text.length.toLocaleString()} characters`,
        duration: 4000,
      });
    } catch (err: any) {
      console.error(err);
      toast("Could not import chapter", {
        description:
          err?.message ??
          "The site may be blocking client-side fetches. Consider a tiny server proxy for reliability.",
        duration: 6000,
      });
    } finally {
      setIsImportingRR(false);
    }
  };

  const handleRoyalRoadPaste = async (
    e: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    const pasted = e.clipboardData.getData("text")?.trim();
    const url = extractRoyalRoadUrl(pasted || "");
    if (!url) return;

    requestAnimationFrame(async () => {
      await importRoyalRoadChapter(url);
    });
  };

  // --- Render ---
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
          const finalName =
            (vals.name && vals.name.trim()) ||
            suggestedTitle ||
            "Untitled Audio";

          if (mode === "ai") {
            createAudioFileFromAi.mutate({
              ...vals,
              name: finalName,
              public: !!isPublic,
            });
            return;
          }

          createAudioFile.mutate({
            ...vals,
            name: finalName,
            public: !!isPublic,
          });
        }}
      />

      <div className="container mx-auto p-4 flex flex-col md:justify-center max-w-5xl">
        {/* STEP 1: Choose how to start */}
        {!mode && (
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight mb-4">
              How would you like to start?
            </h1>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  key: "copy",
                  mode: "copy",
                  label: "Copy & paste text",
                  description: "Paste your text. Quick and simple.",
                  Icon: ClipboardList,
                },
                {
                  key: "ai",
                  mode: "ai",
                  label: "Generate from AI",
                  description:
                    "Give a prompt and generate a story with a length of your choice.",
                  Icon: Wand2,
                },
                {
                  key: "royal-road",
                  mode: "copy",
                  label: "RoyalRoad Chapter",
                  description:
                    "Paste a RoyalRoad chapter URL to generate audio from it.",
                  Icon: BookOpen,
                },
                // {
                //   key: "advanced",
                //   mode: "advanced",
                //   label: "Advanced",
                //   description:
                //     "Add titles and chapter headings. Control pauses and more.",
                //   Icon: AudioLinesIcon,
                // },
              ].map((option) => (
                <Card
                  key={option.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setMode(option.mode)}
                  className="cursor-pointer transition hover:border-primary"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <option.Icon className="h-5 w-5" />
                      {option.label}
                    </CardTitle>
                    <CardDescription>{option.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-end">
                    <Button
                      onClick={() => {
                        form.reset();
                        setMode(option.key);
                      }}
                    >
                      <ArrowRight className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 (both modes): Create new audio file form */}
        {mode && mode !== "advanced" && (
          <Form {...form}>
            <form>
              {/* Back to mode selection */}
              <div className="mb-2">
                <Button
                  className="!pl-0"
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("")}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </div>

              {/* Duration (AI mode only) */}
              {mode === "ai" && (
                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem className="mb-6">
                      <FormLabel className="flex mb-2 items-center justify-between">
                        <span>Audio Book Duration</span>
                        <span className="text-xs text-muted-foreground">
                          {formatHm(field.value)}
                        </span>
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <Slider
                            min={MIN_DURATION}
                            max={MAX_DURATION}
                            step={STEP_MINUTES}
                            value={[Number(field.value ?? 10)]}
                            onValueChange={(vals) => {
                              const v = Array.isArray(vals)
                                ? Number(vals[0])
                                : Number(vals);
                              field.onChange(clampAndStep(v));
                            }}
                            aria-label="Duration in minutes"
                          />
                          <div className="flex items-center gap-3">
                            <Input
                              type="number"
                              inputMode="numeric"
                              className="hidden"
                              min={MIN_DURATION}
                              max={MAX_DURATION}
                              step={STEP_MINUTES}
                              value={field.value ?? 10}
                              onChange={(e) => {
                                const raw = Number(e.target.value);
                                if (Number.isNaN(raw)) return;
                                field.onChange(raw);
                              }}
                              onBlur={(e) => {
                                const raw = Number(e.target.value);
                                const fixed = clampAndStep(
                                  Number.isNaN(raw) ? 10 : raw
                                );
                                field.onChange(fixed);
                              }}
                            />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Title (copy mode only) */}
              {mode === "copy" && (
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className={cn("mb-4 md:max-w-96")}>
                      <FormLabel>
                        Title{" "}
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

                      <p className="text-xs text-muted-foreground mt-1">
                        This is how it appears in your Library. If you leave it
                        blank, we’ll pick a title for you.
                      </p>

                      {!nameValue && suggestedTitle && (
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              form.setValue("name", suggestedTitle, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          >
                            Use “{suggestedTitle}”
                          </Button>
                        </div>
                      )}

                      <p className="text-[11px] text-muted-foreground mt-2">
                        Export filename preview: <code>{slugPreview}.mp3</code>
                      </p>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Language + Speaker row */}
              <div className="flex gap-4 mb-4 items-end flex-wrap">
                {/* Language filter */}
                <div className="flex flex-col gap-2">
                  <FormLabel>Language</FormLabel>
                  <Select
                    value={languageFilter}
                    onValueChange={(v) => {
                      setLanguageFilter(v as (typeof Languages)[number]);
                      const match = speakers.find((s) => s.language === v);
                      // preselect first speaker in that language to keep control stable
                      if (match) {
                        form.setValue("speakerId", match.id, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        setSpeakerId(match.id);
                      } else {
                        // don't clear to ""; keep previous value until user picks one
                      }
                    }}
                  >
                    <SelectTrigger
                      value={languageFilter}
                      className="capitalize w-[180px]"
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

                {/* Speaker select (filtered) */}
                <FormField
                  control={form.control}
                  name="speakerId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Speaker</FormLabel>
                      <FormControl>
                        <Select
                          // ALWAYS controlled — never undefined
                          value={field.value ?? ""}
                          onValueChange={(v) => {
                            if (!v) return;

                            if (!filteredSpeakers.some((s) => s.id === v))
                              return;

                            field.onChange(v);
                            setSpeakerId(v);
                          }}
                          disabled={filteredSpeakers.length === 0}
                        >
                          <SelectTrigger className="w-[220px]">
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
                                <div className="flex items-center gap-2">
                                  <span>
                                    {(s as any).displayName ?? s.name}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      {fieldState.isTouched && <FormMessage />}
                    </FormItem>
                  )}
                />

                {/* Example audio toggle */}
                <ExampleAudioToggle
                  exampleUrl={exampleUrl}
                  speakerId={selectedSpeakerId}
                  disabled={!selectedSpeakerId}
                />
              </div>

              {/* Text */}
              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel className="flex justify-between">
                      <span>
                        {modeTextConfig[mode as keyof typeof modeTextConfig]
                          ?.label || modeTextConfig.default.label}
                      </span>
                    </FormLabel>

                    <FormControl>
                      <InputGroup>
                        <InputGroupTextarea
                          rows={4}
                          className="max-h-[400px]"
                          placeholder={
                            modeTextConfig[mode as keyof typeof modeTextConfig]
                              ?.placeholder ||
                            modeTextConfig.default.placeholder
                          }
                          {...field}
                          value={field.value ?? ""}
                          onPaste={
                            mode === "copy" || mode === "royal-road"
                              ? handleRoyalRoadPaste
                              : undefined
                          }
                        />

                        {/* Add-on with your credit/loader text */}
                        <InputGroupAddon align="block-end">
                          {/* Keep it tiny + responsive like your original (hidden on mobile) */}
                          <div
                            className="flex gap-2 items-end justify-end"
                            aria-live="polite"
                          >
                            {isImportingRR && mode === "copy" && (
                              <InputGroupText className="text-xs text-muted-foreground animate-pulse">
                                Importing from RoyalRoad…
                              </InputGroupText>
                            )}

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

                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-3">
                <Button
                  className="md:w-fit w-full"
                  type="button"
                  onClick={handleCreateClick}
                  disabled={
                    createAudioFile.isPending ||
                    createAudioFileFromAi.isPending ||
                    !form.formState.isValid ||
                    !form.getValues("speakerId") ||
                    filteredSpeakers.length === 0
                  }
                >
                  <AudioLinesIcon className="h-4 w-4" />
                  {createAudioFile.isPending || createAudioFileFromAi.isPending
                    ? "Synthesizing..."
                    : "Create Audio"}
                </Button>

                {/* Admin-only Test Audio Creation Button */}
                {!isAdmin && (
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        !form.formState.isValid ||
                        !form.getValues("speakerId") ||
                        filteredSpeakers.length === 0
                      }
                      onClick={() => {
                        const vals = form.getValues();
                        testAudioMutation.mutate({
                          name: vals.name?.trim() || "Untitled Audio",
                          speakerId: vals.speakerId,
                          text: vals.text,
                          durationMinutes: vals.durationMinutes,
                          public: vals.public,
                          mode: mode as "copy" | "ai",
                          chunkSize: 1000,
                        });
                      }}
                    >
                      Test
                    </Button>
                  </div>
                )}
              </div>
            </form>
          </Form>
        )}

        {mode && mode === "advanced" && (
          <AdvancedAudioForm speakers={speakers} />
        )}
      </div>
    </>
  );
};

export default NewAudioClient;
