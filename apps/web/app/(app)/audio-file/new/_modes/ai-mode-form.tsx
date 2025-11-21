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
import { ArrowLeft, AudioLinesIcon } from "lucide-react";

// Duration helpers (same values as original)
const MIN_DURATION = 5; // minutes
const MAX_DURATION = 60; // minutes
const STEP_MINUTES = 5; // slider/input increments
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(n, lo), hi);
const roundToStep = (n: number, step = STEP_MINUTES) =>
  Math.round(n / step) * step;
const clampAndStep = (n: number) =>
  clamp(roundToStep(n), MIN_DURATION, MAX_DURATION);
const formatHm = (minutes?: number) => {
  if (!Number.isFinite(minutes)) return "—";
  const m = Math.max(0, Math.floor(Number(minutes)));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0 && r > 0) return `${h}h ${r}min`;
  if (h > 0) return `${h}h`;
  return `${r}min`;
};

const Schema = z.object({
  speakerId: z.string().uuid({ message: "Please select a speaker." }),
  text: z.string().min(1, "Please enter a prompt."),
  durationMinutes: z.number().min(MIN_DURATION).max(MAX_DURATION),
  public: z.boolean(),
});

type Props = {
  speakers: Speaker[];
  onBack: () => void;
};

export function AiModeForm({ speakers, onBack }: Props) {
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
    durationMinutes: storeDurationMinutes,
    setDurationMinutes,
    language: storedLanguage,
    setLanguage: setStoredLanguage,
  } = useNewAudioFormStore();

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

  const filteredSpeakers = useMemo(() => {
    const list = Array.isArray(speakers) ? speakers : [];
    return list.filter(
      (s) => (s as any).language === (languageFilter as unknown as string)
    );
  }, [speakers, languageFilter]);

  useEffect(() => {
    if (languageFilter && languageFilter !== storedLanguage) {
      setStoredLanguage(languageFilter as unknown as string);
    }
  }, [languageFilter, storedLanguage]);

  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      text: text || "",
      public: false,
      speakerId: speakerId || speakers?.[0]?.id,
      durationMinutes: storeDurationMinutes ?? 10,
    },
    mode: "onChange",
  });

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "text" && typeof value.text === "string")
        setText(value.text);
      if (
        name === "durationMinutes" &&
        typeof value.durationMinutes === "number"
      ) {
        setDurationMinutes(value.durationMinutes);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, setText, setDurationMinutes]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (text && text !== form.getValues("text")) {
      form.setValue("text", text, { shouldDirty: false });
      form.trigger("text");
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
  }, [text, storeDurationMinutes]);

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

  const createAudioFileFromAi = api.audio.inworld.createFromAi.useMutation({
    onSuccess: (data) => {
      router.push(`/audio-file/${data.audioFile.id}`);
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

  const selectedSpeakerId = form.watch("speakerId");
  const currentSpeaker = filteredSpeakers.find(
    (s) => s.id === selectedSpeakerId
  );
  const exampleUrl =
    typeof currentSpeaker?.exampleAudio === "string" &&
    currentSpeaker.exampleAudio.length > 0
      ? currentSpeaker.exampleAudio
      : undefined;

  // Credits for AI mode: minutes * 1000
  const creditsQuery = api.credits.fetch.useQuery();
  const durationMinutes = form.watch("durationMinutes") ?? 0;
  const requiredCredits = durationMinutes * 1000;
  const availableCredits = userData
    ? (creditsQuery.data?.credits?.amount ?? 0)
    : 9999999999;
  const overCharacterLimit = requiredCredits > availableCredits;

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
          createAudioFileFromAi.mutate({ ...vals, public: !!isPublic });
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
          {/* Duration */}
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

          {/* Language + Speaker row */}
          <div className="flex gap-4 mb-4 items-end flex-wrap">
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

            <ExampleAudioToggle
              exampleUrl={exampleUrl}
              speakerId={selectedSpeakerId}
              disabled={!selectedSpeakerId}
            />
          </div>

          {/* Prompt */}
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem className="mb-4">
                <FormLabel className="flex justify-between">
                  <span>Prompt</span>
                </FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupTextarea
                      rows={4}
                      className="max-h-[400px]"
                      placeholder="What would you like your story to be about?"
                      {...field}
                      value={field.value ?? ""}
                    />
                    <InputGroupAddon align="block-end">
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

          <div className="flex items-center gap-3">
            <Button
              className="md:w-fit w-full"
              type="button"
              onClick={handleCreateClick}
              disabled={
                createAudioFileFromAi.isPending ||
                !form.formState.isValid ||
                !form.getValues("speakerId") ||
                filteredSpeakers.length === 0
              }
            >
              <AudioLinesIcon className="h-4 w-4" />
              {createAudioFileFromAi.isPending
                ? "Synthesizing..."
                : "Create Audio"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
