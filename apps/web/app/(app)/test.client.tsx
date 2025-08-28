"use client";
import AudioClip from "@/components/audio/audio-clip";
import { ConfirmAudioVisibility } from "@/components/confirm-audio-visibility";
import ExampleAudioToggle from "@/components/example-audio-toggle";
import Logo from "@/components/svgs/logo";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";
import { AudioLinesIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { LoginRequiredDialog } from "@/components/login-required-modal";
import { NotEnoughCreditsDialog } from "@/components/not-enough-credits-modal";
import { useMediaQuery } from "@/hooks/use-media-query";
import { authClient } from "@/lib/auth-client";
import { MEDIA_QUERY } from "@/lib/constants";

// --- Schema ---
const FormSchema = z.object({
  name: z.string().min(2, "Please enter a name.").max(100),
  speakerId: z.string().uuid().min(1, "Please select a speaker."),
  text: z.string().min(1, "Please enter text to synthesize."),
  public: z.boolean(),
});

const TestClient = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const isDesktop = useMediaQuery(MEDIA_QUERY.MD);
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
  const { data: speakersData, isLoading: speakersLoading } =
    api.speakers.getAll.useQuery();

  const [initialSpeakerId, setInitialSpeakerId] = useState<string | undefined>(
    undefined
  );
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      text: "",
      public: false,
      speakerId: initialSpeakerId,
    },
    mode: "onChange",
  });

  const createAudioFile = api.audio.inworld.create.useMutation({
    onSuccess: (data) => {
      setSelectedAudioFileId(data.audioFile.id);
      form.reset();
    },
    onError: (error) => {
      console.error("Error creating audio file:", error);
      toast("Error", {
        description: error.message,
        duration: 6000,
      });
    },
  });

  // Auto-select a speaker when loaded
  useEffect(() => {
    if (!speakersData?.speakers?.length) return;
    if (!initialSpeakerId) {
      setInitialSpeakerId(speakersData.speakers[0]!.id);
      form.setValue("speakerId", speakersData.speakers[0]!.id);
    }
  }, [speakersData, initialSpeakerId, form]);

  // Derived values
  const selectedSpeakerId = form.watch("speakerId");
  const currentSpeaker = speakersData?.speakers.find(
    (s) => s.id === selectedSpeakerId
  );
  const exampleUrl =
    typeof currentSpeaker?.exampleAudio === "string" &&
    currentSpeaker.exampleAudio.length > 0
      ? currentSpeaker.exampleAudio
      : undefined;

  const textValue = form.watch("text") ?? "";
  const requiredCredits = textValue.length; // adjust if 1 char != 1 credit
  const availableCredits = userData
    ? (creditsQuery.data?.credits?.amount ?? 0)
    : 9999999999;
  const overCharacterLimit = requiredCredits > availableCredits;

  // Clicking Create Audio:
  const handleCreateClick = async () => {
    // always validate the form first
    const valid = await form.trigger();
    if (!valid) return;

    // (1) Not logged in → show login dialog
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    // (2) Over credit/character limit → show credits dialog
    if (overCharacterLimit) {
      setShowCredits(true);
      return;
    }
    // (3) Otherwise continue to your existing confirmation flow
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

      {/* Visibility confirmation stays as-is */}
      <ConfirmAudioVisibility
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onCancel={async () => {}}
        onConfirm={async ({ isPublic }) => {
          createAudioFile.mutate({
            ...form.getValues(),
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

        {/* Create new audio file form */}
        <Form {...form}>
          <form className={cn(selectedAudioFileId.length > 0 ? "hidden" : "")}>
            {/* File name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="mb-4 md:max-w-80">
                  <FormLabel>File name</FormLabel>
                  <FormControl>
                    <Input placeholder="" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={speakersLoading}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              speakersLoading
                                ? "Loading speakers..."
                                : "Select a speaker"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {speakersData?.speakers?.length ? (
                            speakersData.speakers.map((speaker) => (
                              <SelectItem key={speaker.id} value={speaker.id}>
                                <div className="flex items-center gap-2">
                                  <span>{speaker.name}</span>
                                </div>
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              {speakersLoading
                                ? "Loading..."
                                : "No speakers found"}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {/* Only show error if field has been touched */}
                    {fieldState.isTouched && <FormMessage />}
                  </FormItem>
                )}
              />

              {/* Example audio toggle */}
              <ExampleAudioToggle
                exampleUrl={exampleUrl}
                speakerId={selectedSpeakerId}
                disabled={speakersLoading || !selectedSpeakerId}
              />
            </div>

            {/* Text */}
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel className="flex justify-between">
                    <span>Text</span>
                    <span className="flex gap-2">
                      {(field.value.length > 0 ||
                        creditsQuery.data?.credits) && (
                        <span
                          className={cn(
                            "text-xs",
                            overCharacterLimit
                              ? "text-amber-600"
                              : "text-muted-foreground"
                          )}
                        >
                          {field.value.length > 0
                            ? `${field.value.length} Credits - $${((field.value.length * 10) / 1_000_000).toFixed(4)}`
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
                      placeholder="Enter text to synthesize"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={handleCreateClick}
                // IMPORTANT: do NOT disable based on credit/character limit.
                disabled={createAudioFile.isPending || !form.formState.isValid}
              >
                <AudioLinesIcon className="h-4 w-4" />
                {createAudioFile.isPending ? "Synthesizing..." : "Create Audio"}
              </Button>
            </div>
          </form>
        </Form>

        {/* Render Audio */}
        {audioFile.data?.audioFile && (
          <div className="flex flex-col gap-4">
            <AudioClip af={audioFile.data.audioFile} />
          </div>
        )}
      </div>
    </>
  );
};

export default TestClient;
