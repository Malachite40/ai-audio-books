"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmAudioVisibility } from "@/components/confirm-audio-visibility";
import ExampleAudioToggle from "@/components/example-audio-toggle";
import { LoginRequiredDialog } from "@/components/login-required-modal";
import { NotEnoughCreditsDialog } from "@/components/not-enough-credits-modal";
import { authClient } from "@/lib/auth-client";
import { useNewAudioFormStore } from "@/store/use-new-audio-form-store";
import { api } from "@/trpc/react";
import { Speaker } from "@workspace/database";
import { Languages } from "@workspace/trpc/client";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
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
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowLeft, AudioLinesIcon } from "lucide-react";

// Schema for copy/upload/royal-road text generation
const Schema = z.object({
  name: z.string().trim().max(100).optional(),
  speakerId: z.string().uuid({ message: "Please select a speaker." }),
  text: z.string().min(1, "Please enter text to synthesize."),
  public: z.boolean(),
  includeTitle: z.boolean().default(true),
});

// Helpers
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

type Props = {
  speakers: Speaker[];
  onBack: () => void;
  label?: string;
  placeholder?: string;
};

export function CopyModeForm({
  speakers,
  onBack,
  label = "Text",
  placeholder = "Once upon a time...",
}: Props) {
  const router = useRouter();
  const { data: userData } = authClient.useSession();
  const isLoggedIn = !!userData?.session;
  const isAdmin = userData?.user.role === "admin";

  const [showConfirm, setShowConfirm] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  const {
    setText,
    hasHydrated,
    text,
    setSpeakerId,
    speakerId,
    name: storeName,
    setName: setStoreName,
    language: storedLanguage,
    setLanguage: setStoredLanguage,
    reset: resetStore,
  } = useNewAudioFormStore();

  // Language init
  const initialLanguage: (typeof Languages)[number] = useMemo(() => {
    const fromStore = (storedLanguage as unknown as string) || undefined;
    if (fromStore && (Languages as readonly string[]).includes(fromStore)) {
      return fromStore as (typeof Languages)[number];
    }
    const fromSpeaker = speakers.find((s) => s.id === speakerId)
      ?.language as unknown as string | undefined;
    if (fromSpeaker && (Languages as readonly string[]).includes(fromSpeaker)) {
      return fromSpeaker as (typeof Languages)[number];
    }
    const fallback = (speakers?.[0]?.language as any) ?? Languages[0];
    return (Languages as readonly string[]).includes(fallback)
      ? (fallback as (typeof Languages)[number])
      : Languages[0];
  }, [speakers, speakerId, storedLanguage]);

  const [languageFilter, setLanguageFilter] =
    useState<(typeof Languages)[number]>(initialLanguage);

  // Keep local language filter in sync with persisted language
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

  // Filter speakers by language
  const filteredSpeakers = useMemo(() => {
    const list = Array.isArray(speakers) ? speakers : [];
    return list.filter(
      (s) => (s as any).language === (languageFilter as unknown as string)
    );
  }, [speakers, languageFilter]);

  // Persist language selection when it changes
  useEffect(() => {
    if (languageFilter && languageFilter !== storedLanguage) {
      setStoredLanguage(languageFilter as unknown as string);
    }
  }, [languageFilter, storedLanguage]);

  const form = useForm<z.input<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: "",
      text: text || "",
      public: false,
      speakerId: speakerId || speakers?.[0]?.id,
      includeTitle: true,
    },
    mode: "onChange",
  });

  // Sync form values to store on change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "text" && typeof value.text === "string")
        setText(value.text);
      if (name === "name") setStoreName(value.name ?? "");
    });
    return () => subscription.unsubscribe();
  }, [form, setText, setStoreName]);

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
  }, [text, storeName]);

  // Ensure selected speaker remains valid with language filter
  useEffect(() => {
    if (!hasHydrated || !speakerId) return;
    const speaker = speakers.find((s) => s.id === speakerId);
    if (!speaker) return;
    if (speaker.language !== languageFilter) {
      setLanguageFilter(speaker.language as (typeof Languages)[number]);
      return;
    }
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

  // Mutations
  const createAudioFile = api.audio.inworld.createFromCopy.useMutation({
    onSuccess: (data) => {
      router.push(`/audio-file/${data.audioFile.id}`);
      resetStore();
    },
    onError: (error) => {
      console.error("Error creating audio file:", error);
      toast("Error", { description: error.message, duration: 6000 });
    },
  });
  const testAudioMutation = api.audio.test.create.useMutation({
    onSuccess: (data) => router.push(`/audio-file/${data.audioFile.id}`),
    onError: (error) => {
      toast("Test audio creation failed", {
        description: error.message,
        duration: 4000,
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

  // Credits
  const creditsQuery = api.credits.fetch.useQuery();
  const requiredCredits = textValue.length;
  const availableCredits = userData
    ? (creditsQuery.data?.credits?.amount ?? 0)
    : 9999999999;
  const overCharacterLimit = requiredCredits > availableCredits;

  // RoyalRoad paste support (same behavior as before)
  const normalizeImportantText = (raw: string): string => {
    let text = raw;

    // Remove leading blockquote markers ("> ")
    text = text.replace(/^>\s*/gm, "");

    // Strip markdown-style emphasis/bold markers while keeping inner text
    text = text.replace(/[*_]+/g, "");

    // Collapse multiple spaces
    text = text.replace(/[ \t]+/g, " ");

    // Collapse excessive blank lines
    text = text.replace(/\n{3,}/g, "\n\n");

    // Trim each line
    text = text
      .split("\n")
      .map((line) => line.trim())
      .join("\n");

    return text.trim();
  };

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
  const READABILITY_PROXY_PREFIX = "https://r.jina.ai/http://";
  const toProxyUrl = (targetUrl: string) =>
    READABILITY_PROXY_PREFIX + targetUrl.replace(/^https?:\/\//i, "");

  const [isImportingRR, setIsImportingRR] = useState(false);
  const importRoyalRoadChapter = async (url: string) => {
    if (isImportingRR) return;
    setIsImportingRR(true);
    toast("Fetching RoyalRoad chapter…");
    try {
      const proxied = toProxyUrl(url);
      const res = await fetch(proxied, { credentials: "omit" });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      const body = await res.text();
      let text: string | null = null;

      // Prefer extracting only the main chapter content from RoyalRoad
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(body, "text/html");
        const chapterDiv = doc.querySelector(
          "div.chapter-inner.chapter-content"
        );
        if (chapterDiv) {
          text = chapterDiv.textContent || "";
        }
      } catch {
        // If DOM parsing fails, fall back to regex-based cleanup below
      }

      if (!text) {
        text = body
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<\/?(?:\w+)[^>]*>/g, "\n")
          .replace(/^Title:.*$/gm, "")
          .replace(/^URL Source:.*$/gm, "")
          .replace(/^Markdown Content:.*$/gm, "")
          .trim();
      }

      if (text) {
        text = normalizeImportantText(text);
      }

      if (!text) throw new Error("No content found");
      form.setValue("name", buildNameFromUrl(url), {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("text", text, { shouldDirty: true, shouldValidate: true });
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

  // Create flow
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
          });
        }}
      />

      <div className="mb-2">
        <Button
          className="!pl-0"
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <Form {...form}>
        <form>
          {/* Title */}
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
                  if (match) {
                    form.setValue("speakerId", match.id, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setSpeakerId(match.id);
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
                    <SelectItem className="capitalize" key={lang} value={lang}>
                      {lang.toLocaleLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Speaker select */}
            <FormField
              control={form.control}
              name="speakerId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Speaker</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => {
                        if (!v) return;
                        if (!filteredSpeakers.some((s) => s.id === v)) return;
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
                              <span>{(s as any).displayName ?? s.name}</span>
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
                  <span>{label}</span>
                </FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupTextarea
                      rows={4}
                      className="max-h-[400px]"
                      placeholder={placeholder}
                      {...field}
                      value={field.value ?? ""}
                      onPaste={handleRoyalRoadPaste}
                    />
                    <InputGroupAddon align="block-end">
                      <div
                        className="flex gap-2 items-end justify-end"
                        aria-live="polite"
                      >
                        {isImportingRR && (
                          <InputGroupText className="text-xs animate-pulse text-primary">
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
                              ? `${requiredCredits} Credits - $${((requiredCredits * 10) / 1_000_000).toFixed(4)}`
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

          {/* Include title narration checkbox */}
          <FormField
            control={form.control}
            name="includeTitle"
            render={({ field }) => (
              <FormItem className="mb-4 flex-1">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="include-title"
                    checked={!!field.value}
                    onCheckedChange={(v) => field.onChange(v)}
                  />
                  <div className="grid gap-2">
                    <Label htmlFor="include-title">Include Title</Label>
                    <p className="text-muted-foreground text-xs">
                      {`When enabled, the generated audio will include the title and  speaker introduction at the start.`}
                    </p>
                  </div>
                </div>
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
                !form.formState.isValid ||
                !form.getValues("speakerId") ||
                filteredSpeakers.length === 0
              }
            >
              <AudioLinesIcon className="h-4 w-4" />
              {createAudioFile.isPending ? "Synthesizing..." : "Create Audio"}
            </Button>

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
                      durationMinutes: undefined,
                      public: vals.public ?? false,
                      mode: "copy",
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
    </>
  );
}
