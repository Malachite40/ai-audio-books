// app/(whatever)/new-audio-client.tsx
"use client";

import { ConfirmAudioVisibility } from "@/components/confirm-audio-visibility";
import ExampleAudioToggle from "@/components/example-audio-toggle";
import { LoginRequiredDialog } from "@/components/login-required-modal";
import { NotEnoughCreditsDialog } from "@/components/not-enough-credits-modal";
import Logo from "@/components/svgs/logo";
import { authClient } from "@/lib/auth-client";
import { useNewAudioFormStore } from "@/store/use-new-audio-form-store";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Speaker } from "@workspace/database";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Slider } from "@workspace/ui/components/slider";
import { Textarea } from "@workspace/ui/components/textarea";
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

// ------------------------------
// Helpers for duration UX
// ------------------------------
const MIN_DURATION = 5; // minutes
const MAX_DURATION = 60; // minutes (2 hours)
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
  durationMinutes: z.number(/* ... */).optional(),
  public: z.boolean(),
});

// --- RoyalRoad helpers (client-only import flow) ---
// Matches chapter URLs like:
// https://www.royalroad.com/fiction/21220/mother-of-learning/chapter/301778/1-good-morning-brother
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
// The proxy expects http:// after its host; we pass target without scheme.
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
    text,
    setSpeakerId,
    speakerId,
    setDurationMinutes,
    durationMinutes: storeDurationMinutes,
    name: storeName,
    setName: setStoreName,
    reset: resetStore,
  } = useNewAudioFormStore();
  // STEP state (2-step process) in URL via nuqs
  // step 1: choose "mode" -> "copy" or "ai"
  // step 2: show the form (same form, with slight UX differences)
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

  const [selectedAudioFileId, setSelectedAudioFileId] = useQueryState(
    "id",
    parseAsString.withDefault("").withOptions({})
  );

  // Auth state (assumes next-auth). If you don't use next-auth, swap this for your auth query.
  const { data: userData } = authClient.useSession();
  const isLoggedIn = !!userData?.session;

  // Queries
  const audioFile = api.audio.fetch.useQuery({ id: selectedAudioFileId });
  const creditsQuery = api.credits.fetch.useQuery();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      text: text || "",
      public: false,
      speakerId: speakerId || speakers[0]?.id,
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
      if (name === "speakerId") {
        setSpeakerId(value.speakerId);
      }
      if (
        name === "durationMinutes" &&
        typeof value.durationMinutes === "number"
      ) {
        setDurationMinutes(value.durationMinutes);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, setText, setSpeakerId, setDurationMinutes]);

  // Restore values from store on mount (if not already set)
  useEffect(() => {
    if (text && text !== form.getValues("text")) {
      form.setValue("text", text, { shouldDirty: false });
      form.trigger();
    }
    if (storeName && storeName !== form.getValues("name")) {
      form.setValue("name", storeName, { shouldDirty: false });
      form.trigger();
    }
    if (
      typeof storeDurationMinutes === "number" &&
      storeDurationMinutes !== form.getValues("durationMinutes")
    ) {
      form.setValue("durationMinutes", storeDurationMinutes, {
        shouldDirty: false,
      });
      form.trigger();
    }

    // Only run on mount or if values change
  }, [text, speakerId, storeDurationMinutes]);

  useEffect(() => {
    const current = form.getValues("speakerId");
    const exists = (id?: string) => !!id && speakers.some((s) => s.id === id);

    const preferred =
      (exists(speakerId) && speakerId) ||
      (exists(current) && current) ||
      speakers[0]?.id ||
      undefined;

    if (preferred !== current) {
      form.setValue("speakerId", preferred as any, { shouldDirty: false });
    }

    if (speakerId && !exists(speakerId)) {
      form.setError("speakerId", {
        type: "validate",
        message:
          "Previously selected speaker is no longer available. Please pick another.",
      });
    }
  }, [speakers, speakerId, form]);

  // 2) Robust restore logic
  useEffect(() => {
    // get what's currently in the form and in your store
    const current = form.getValues("speakerId");
    const persisted = speakerId; // from useTextInputStore()
    const exists = (id?: string) => !!id && speakers.some((s) => s.id === id);

    // prefer a valid persisted id, else a valid current id, else first speaker, else undefined
    const next =
      (exists(persisted) && persisted) ||
      (exists(current) && current) ||
      speakers[0]?.id ||
      undefined;

    // only update if different (prevents loops)
    if (next !== current) {
      form.setValue("speakerId", next as any, { shouldDirty: false });
    }

    // optional: surface error when persisted id disappeared
    if (persisted && !exists(persisted)) {
      form.setError("speakerId", {
        type: "validate",
        message:
          "Previously selected speaker is no longer available. Please pick another.",
      });
    }
  }, [speakers, speakerId]); // runs on reload/rehydration or speaker list changes

  const createAudioFile = api.audio.inworld.create.useMutation({
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
  const currentSpeaker = speakers.find((s) => s.id === selectedSpeakerId);
  const exampleUrl =
    typeof currentSpeaker?.exampleAudio === "string" &&
    currentSpeaker.exampleAudio.length > 0
      ? currentSpeaker.exampleAudio
      : undefined;

  const nameValue = form.watch("name") ?? "";
  const textValue = form.watch("text") ?? "";

  const suggestedTitle =
    nameValue.trim().length > 0
      ? "" // user is typing; don't suggest
      : "Untitled Audio";

  const slugPreview = slugify((nameValue || suggestedTitle || "audio").trim());

  // Credits calculation: if AI mode, use durationMinutes * 1000; else use text length
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
    if (!valid) return;

    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    if (overCharacterLimit) {
      setShowCredits(true);
      return;
    }
    setShowConfirm(true);
  };

  // --- RoyalRoad import state + logic (kept inside this component) ---
  const [isImportingRR, setIsImportingRR] = useState(false);

  const importRoyalRoadChapter = async (url: string) => {
    if (isImportingRR) return;
    setIsImportingRR(true);
    toast("Fetching RoyalRoad chapter…");

    try {
      // Client-only readable proxy fetch
      const proxied = toProxyUrl(url);
      const res = await fetch(proxied, { credentials: "omit" });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);

      // Proxy returns readable text / minimal HTML; normalize to plain text.
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

      // Fill in form values (keep RR naming behavior)
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
    if (!url) return; // allow normal paste

    // Let the URL paste happen for immediate feedback
    requestAnimationFrame(async () => {
      await importRoyalRoadChapter(url); // replaces pasted URL with chapter text later
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

          createAudioFile.mutate({
            ...vals,
            mode: mode as "copy" | "ai",
            name: finalName,
            public: !!isPublic,
          });
        }}
      />

      <div className="container mx-auto p-4 flex flex-col md:justify-center max-w-5xl">
        {/* Loading State */}
        {audioFile.isLoading && selectedAudioFileId.length > 0 && (
          <div className="mb-4 w-full gap-4 text-primary justify-center flex items-center flex-col animate-pulse duration-100">
            <p className="mb-4">Loading...</p>
          </div>
        )}

        {/* Error page: Create new audio file */}
        {!audioFile.isLoading &&
          !audioFile.data?.audioFile &&
          selectedAudioFileId.length > 0 && (
            <div className="mb-4 w-full justify-center flex items-center flex-col">
              <Logo className="size-30" />
              <p className="mb-4">No audio file found.</p>
              <Button
                className="flex gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedAudioFileId("");
                }}
                variant={"outline"}
              >
                <AudioLinesIcon className="h-4 w-4" />
                Create New Audio File
              </Button>
            </div>
          )}

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
                  label: "Copy & paste text",
                  description: "Paste your text. Quick and simple.",
                  Icon: ClipboardList,
                },
                {
                  key: "ai",
                  label: "Generate from AI",
                  description:
                    "Give a prompt and generate a story with a length of your choice.",
                  Icon: Wand2,
                },
                {
                  key: "royal-road",
                  label: "RoyalRoad Chapter",
                  description:
                    "Paste a RoyalRoad chapter URL to generate audio from it.",
                  Icon: BookOpen,
                },
              ].map((option) => (
                <Card
                  key={option.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setMode(option.key)}
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
        {mode && (
          <Form {...form}>
            <form
              className={cn(selectedAudioFileId.length > 0 ? "hidden" : "")}
            >
              {/* Back to mode selection (also visible for copy mode) */}
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
                          {/* Slider controls the same field (5–120 minutes, 5-min steps) */}
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
                                // Let the user type; clamp/step on blur below
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

              {/* Title (formerly "File name") */}
              {mode === "copy" && (
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
                          value={field.value ?? ""} // avoid uncontrolled warnings
                        />
                      </FormControl>

                      <p className="text-xs text-muted-foreground mt-1">
                        {`This is how it appears in your Library. If you leave it
                      blank, we’ll pick a title for you.`}
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

              <div className="flex gap-4 mb-4 items-end">
                {/* Speaker select */}
                <FormField
                  control={form.control}
                  name="speakerId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Speaker</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? undefined}
                          onValueChange={(v) => {
                            field.onChange(v); // update RHF
                            setSpeakerId(v); // update store (user action only)
                          }}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select a speaker" />
                          </SelectTrigger>
                          <SelectContent>
                            {speakers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <div className="flex items-center gap-2">
                                  <span>{s.name}</span>
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
                      {/* Desktop: show credits info in label */}
                      <span className="hidden md:flex gap-2 items-center">
                        {isImportingRR && mode === "copy" && (
                          <span className="text-xs text-muted-foreground animate-pulse">
                            Importing from RoyalRoad…
                          </span>
                        )}
                        {(requiredCredits > 0 ||
                          creditsQuery.data?.credits) && (
                          <span
                            className={cn(
                              "text-xs",
                              overCharacterLimit
                                ? "text-amber-600"
                                : "text-muted-foreground"
                            )}
                          >
                            {requiredCredits > 0
                              ? `${requiredCredits} Credits - $${((requiredCredits * 10) / 1_000_000).toFixed(4)}`
                              : "0"}
                            {typeof availableCredits === "number" &&
                              userData &&
                              ` |  Remaining Credits: ${availableCredits}`}
                          </span>
                        )}
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        className="max-h-[400px]"
                        placeholder={
                          modeTextConfig[mode as keyof typeof modeTextConfig]
                            ?.placeholder || modeTextConfig.default.placeholder
                        }
                        {...field}
                        value={field.value ?? ""}
                        onPaste={
                          mode === "copy" || mode === "royal-road"
                            ? handleRoyalRoadPaste
                            : undefined
                        }
                      />
                    </FormControl>

                    {/* Mobile: show credits info below input */}
                    <div className="md:hidden mt-1">
                      {(requiredCredits > 0 || creditsQuery.data?.credits) && (
                        <span
                          className={cn(
                            "text-xs",
                            overCharacterLimit
                              ? "text-amber-600"
                              : "text-muted-foreground"
                          )}
                        >
                          {requiredCredits > 0
                            ? `${requiredCredits} Credits - $${((requiredCredits * 10) / 1_000_000).toFixed(4)}`
                            : "0"}
                          {typeof availableCredits === "number" &&
                            userData &&
                            ` |  Remaining Credits: ${availableCredits}`}
                        </span>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-3">
                <Button
                  className="md:w-fit w-full"
                  type="button"
                  onClick={handleCreateClick}
                  // Do NOT disable based on credits; we surface the modal instead.
                  disabled={
                    createAudioFile.isPending || !form.formState.isValid
                  }
                >
                  <AudioLinesIcon className="h-4 w-4" />
                  {createAudioFile.isPending
                    ? "Synthesizing..."
                    : "Create Audio"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </>
  );
};

export default NewAudioClient;
