"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmAudioVisibility } from "@/components/confirm-audio-visibility";
import ExampleAudioToggle from "@/components/example-audio-toggle";
import { FileDropzone } from "@/components/file-dropzone";
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
// Defer pdfjs-dist import to the client at runtime to avoid SSR DOM errors

const Schema = z.object({
  name: z.string().trim().max(100).optional(),
  speakerId: z.string().uuid({ message: "Please select a speaker." }),
  text: z.string().min(1, "Please enter text to synthesize."),
  public: z.boolean(),
  includeTitle: z.boolean().default(true),
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

type Props = { speakers: Speaker[]; onBack: () => void };

export function UploadModeForm({ speakers, onBack }: Props) {
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

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "text" && typeof value.text === "string")
        setText(value.text);
      if (name === "name") setStoreName(value.name ?? "");
    });
    return () => subscription.unsubscribe();
  }, [form, setText, setStoreName]);

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

  const selectedSpeakerId = form.watch("speakerId");
  const currentSpeaker = filteredSpeakers.find(
    (s) => s.id === selectedSpeakerId
  );
  const exampleUrl =
    typeof currentSpeaker?.exampleAudio === "string" &&
    currentSpeaker.exampleAudio.length > 0
      ? currentSpeaker.exampleAudio
      : undefined;

  const creditsQuery = api.credits.fetch.useQuery();
  const requiredCredits = (form.watch("text") ?? "").length;
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

  // Two-step flow state
  type Phase = "upload" | "confirm" | "form";
  const [phase, setPhase] = useState<Phase>("upload");
  const [pendingText, setPendingText] = useState<string>("");
  const [pendingTitle, setPendingTitle] = useState<string>("");
  const [uploadedMeta, setUploadedMeta] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);

  // Upload helpers
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfWorkerRef = useRef<Worker | null>(null);
  useEffect(() => {
    return () => {
      try {
        if (pdfWorkerRef.current) {
          pdfWorkerRef.current.terminate();
          pdfWorkerRef.current = null;
        }
        // GlobalWorkerOptions is available only after dynamic import; clear defensively
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const mod: any = (globalThis as any).__pdfjs_mod__;
          if (mod?.GlobalWorkerOptions)
            mod.GlobalWorkerOptions.workerPort = undefined;
        } catch {}
      } catch {}
    };
  }, []);
  const handleBoxClick = () => fileInputRef.current?.click();
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = "copy";
    } catch {}
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const f =
        Array.from(files).find(
          (fi) => /\.txt$/i.test(fi.name) || /\.pdf$/i.test(fi.name)
        ) || files[0];
      void handleUploadFile(f);
    }
  };
  const handleFileSelect = (files: FileList | null) => {
    const file = files?.[0] ?? null;
    void handleUploadFile(file);
  };
  const readTxtFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsText(file);
    });
  const basename = (name: string) => name.replace(/\.[^.]+$/, "");
  const handleUploadFile = async (file?: File | null) => {
    if (!file) return;
    try {
      if (file.type.startsWith("text/") || /\.txt$/i.test(file.name)) {
        const text = await readTxtFile(file);
        if (!text?.trim()) throw new Error("No text content found in file");
        setUploadedMeta({
          name: file.name,
          size: file.size,
          type: file.type || "text/plain",
        });
        setPendingTitle(basename(file.name));
        setPendingText(text);
        setPhase("confirm");
        toast("File imported", {
          description: `${file.name} – ${text.length.toLocaleString()} characters`,
          duration: 3000,
        });
        return;
      }
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        try {
          const mod: any = await import("pdfjs-dist");
          // cache module on global for cleanup on unmount
          (globalThis as any).__pdfjs_mod__ = mod;
          if (!pdfWorkerRef.current) {
            pdfWorkerRef.current = new Worker(
              new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
              { type: "module" }
            );
          }
          if (mod?.GlobalWorkerOptions)
            mod.GlobalWorkerOptions.workerPort = pdfWorkerRef.current;
          const task = mod.getDocument({ data: buf } as any);
          const doc = await task.promise;
          let out = "";
          for (let i = 1; i <= doc.numPages; i++) {
            // eslint-disable-next-line no-await-in-loop
            const page = await doc.getPage(i);
            // eslint-disable-next-line no-await-in-loop
            const content = await page.getTextContent();
            const strings = (content.items || [])
              .map((it: any) => it?.str)
              .filter(Boolean);
            out += strings.join(" ") + "\n\n";
          }
          const text = out.trim();
          if (!text) throw new Error("No extractable text found in PDF");
          setUploadedMeta({
            name: file.name,
            size: file.size,
            type: file.type || "application/pdf",
          });
          setPendingTitle(basename(file.name));
          setPendingText(text);
          setPhase("confirm");
          toast("PDF imported", {
            description: `${file.name} – ${text.length.toLocaleString()} characters`,
            duration: 3000,
          });
          return;
        } catch {}
      }
      toast("Unsupported file type", {
        description: `Please upload a .txt or .pdf file. Got: ${file.type || file.name}`,
        duration: 5000,
      });
    } catch (err: any) {
      console.error(err);
      toast("Could not import file", {
        description: err?.message ?? "Unknown error while importing file.",
        duration: 6000,
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

      {phase !== "form" && (
        <div className="mb-4">
          <FileDropzone
            fileInputRef={fileInputRef}
            handleBoxClick={handleBoxClick}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            handleFileSelect={handleFileSelect}
          />
        </div>
      )}

      {uploadedMeta && phase !== "form" && (
        <div className="mb-6 space-y-4 rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">
            <div>
              File:{" "}
              <span className="font-medium text-foreground">
                {uploadedMeta.name}
              </span>
            </div>
            <div>Size: {(uploadedMeta.size / 1024).toFixed(1)} KB</div>
            <div>Type: {uploadedMeta.type || "unknown"}</div>
          </div>
          <div className="max-w-md">
            <Label>Title</Label>
            <Input
              placeholder="Parsed from filename"
              value={pendingTitle}
              onChange={(e) => setPendingTitle(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              Export filename preview:{" "}
              <code>{slugify((pendingTitle || "audio").trim())}.mp3</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                form.setValue(
                  "name",
                  pendingTitle || uploadedMeta.name.replace(/\.[^.]+$/, ""),
                  {
                    shouldDirty: true,
                    shouldValidate: true,
                  }
                );
                form.setValue("text", pendingText, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                setPhase("form");
              }}
            >
              Confirm
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setUploadedMeta(null);
                setPendingText("");
                setPendingTitle("");
                setPhase("upload");
              }}
            >
              Choose another file
            </Button>
          </div>
        </div>
      )}

      {phase === "form" && (
        <Form {...form}>
          <form>
            <div className="flex gap-4 mb-4 items-end flex-wrap">
              <div className="flex flex-col gap-2">
                <Label>Language</Label>
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

            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel className="flex justify-between">
                    <span>Text</span>
                  </FormLabel>
                  <FormControl>
                    <InputGroup>
                      <InputGroupTextarea
                        rows={6}
                        className="max-h-[400px]"
                        placeholder="Parsed text from your file appears here..."
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
      )}
    </>
  );
}
