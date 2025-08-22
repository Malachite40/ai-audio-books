"use client";
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
import { Textarea } from "@workspace/ui/components/textarea";

import { AudioHistoryDrawer } from "@/components/audio-history-drawer";
import AudioClip from "@/components/audio/audio-clip";
import ExampleAudioToggle from "@/components/example-audio-toggle";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { AudioLinesIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const FormSchema = z.object({
  name: z.string().min(2, "Please enter a name.").max(100),
  speakerId: z.string().uuid().min(1, "Please select a speaker."),
  text: z.string().min(1, "Please enter text to synthesize."),
});

const TestClient = () => {
  const [selectedAudioFileId, setSelectedAudioFileId] = useQueryState(
    "id",
    parseAsString.withDefault("").withOptions({})
  );

  const audioFile = api.audio.fetch.useQuery({ id: selectedAudioFileId });

  const creditsQuery = api.credits.fetch.useQuery();

  // Fetch speakers from the speakersRouter
  const { data: speakersData, isLoading: speakersLoading } =
    api.speakers.getAll.useQuery();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      text: "",
    },
  });

  const createAudioFile = api.audio.inworld.create.useMutation({
    onSuccess: (data) => {
      setSelectedAudioFileId(data.audioFile.id);
      form.reset();
    },
    onError: (error) => {
      console.error("Error creating audio file:", error);
    },
  });

  const onSubmitOneShot = async (values: z.infer<typeof FormSchema>) => {
    createAudioFile.mutate(values);
  };

  // select speaker if none is selected after query loads
  useEffect(() => {
    if (!speakersData) return;
    if (!speakersData.speakers.length) return;
    if (form.getValues("speakerId")) return;
    form.setValue("speakerId", speakersData.speakers[0]!.id);
  }, [speakersData, form]);

  // Watch selected speaker and derive example URL
  const selectedSpeakerId = form.watch("speakerId");
  const currentSpeaker = speakersData?.speakers.find(
    (s) => s.id === selectedSpeakerId
  );
  const exampleUrl =
    typeof currentSpeaker?.exampleAudio === "string" &&
    currentSpeaker.exampleAudio.length > 0
      ? currentSpeaker.exampleAudio
      : undefined;

  return (
    <div className="container mx-auto p-4 flex flex-col justify-center">
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
              render={({ field }) => (
                <FormItem className="">
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
                  <FormMessage />
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

          {/* Text to synthesize */}
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem className="mb-4">
                <FormLabel className="flex justify-between">
                  <span>Text to Synthesize</span>
                  <span className="flex gap-2">
                    {(field.value.length > 0 || creditsQuery.data?.credits) && (
                      <span className="text-xs text-muted-foreground">
                        {field.value.length > 0
                          ? `${field.value.length} Credits - $${((field.value.length * 10) / 1000000).toFixed(4)}`
                          : "0"}
                        {creditsQuery.data?.credits &&
                          ` |  Remaining Credits: ${creditsQuery.data.credits.amount}`}
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

          <div className="flex space-x-4">
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmitOneShot)}
              disabled={createAudioFile.isPending || !form.formState.isValid}
            >
              {createAudioFile.isPending
                ? "Synthesizing..."
                : "Synthesize One-Shot"}
            </Button>

            <AudioHistoryDrawer />
          </div>
        </form>
      </Form>

      {audioFile.data && audioFile.data.audioFile && (
        <div className="flex flex-col gap-4">
          <AudioClip af={audioFile.data.audioFile} />
          <div className="flex gap-4">
            <Button
              className="flex gap-2"
              variant="outline"
              onClick={() => {
                setSelectedAudioFileId("");
              }}
            >
              <AudioLinesIcon className="h-4 w-4" />
              <span>New Audio File</span>
            </Button>

            <AudioHistoryDrawer />
          </div>
        </div>
      )}

      {createAudioFile.error && (
        <p className="text-red-500 mt-2">
          One-Shot Error: {createAudioFile.error.message}
        </p>
      )}
    </div>
  );
};

export default TestClient;
