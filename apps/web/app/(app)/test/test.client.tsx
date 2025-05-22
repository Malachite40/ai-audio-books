"use client";
import { AudioHistory } from "@/components/audio/audio-history";
import { useAudioClipsStore } from "@/store/audio-clips-store";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";

const FormSchema = z.object({
  speakerId: z.string().uuid().min(1, "Please select a speaker."),
  language: z.string().min(1, "Please select a language."),
  text: z.string().min(1, "Please enter text to synthesize."),
});

const TestClient = () => {
  const clips = useAudioClipsStore((state) => state.clips);
  const addClip = useAudioClipsStore((state) => state.addClip);
  const updateClip = useAudioClipsStore((state) => state.updateClip);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      speakerId: "",
      language: "en",
      text: "",
    },
  });

  const { data: languages } = api.xtts.getLanguages.useQuery();

  const createAudioFile = api.audio.create.useMutation({
    onSuccess: (data) => {
      addClip({ id: data.audioFile.id });

      console.log("Audio file created:", data);
    },
    onError: (error) => {
      console.error("Error creating audio file:", error);
    },
  });

  const synthesizeOneShotMutation = api.xtts.tts.useMutation({
    onSuccess: (data) => {
      if (data.src) data.src = "";
      updateClip({ ...data, id: data.audioFileId });
    },
    onError: (error) => {
      console.error("One-shot synthesis error:", error);
    },
  });

  const onSubmitOneShot = async (values: z.infer<typeof FormSchema>) => {
    const { audioFile } = await createAudioFile.mutateAsync({
      speakerId: values.speakerId,
      text: values.text,
    });
    synthesizeOneShotMutation.mutate({ ...values, audioFileId: audioFile.id });
  };

  const {
    data: speakerData,
    isPending: speakerDataPending,
    error: speakerError,
  } = api.speakers.getAll.useQuery();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">XTTS Demo</h1>

      <Form {...form}>
        <form>
          <div className="flex gap-4">
            <FormField
              control={form.control}
              name="speakerId"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Speaker</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a speaker" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {speakerData &&
                        speakerData.speakers.map((speaker) => {
                          return (
                            <SelectItem key={speaker.id} value={speaker.id}>
                              {speaker.name}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Language</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {languages?.map((language, index) => (
                        <SelectItem key={language} value={language}>
                          {language}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem className="mb-4">
                <FormLabel>Text to Synthesize</FormLabel>
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
              variant="outline"
              onClick={form.handleSubmit(onSubmitOneShot)}
              disabled={
                synthesizeOneShotMutation.isPending || !form.formState.isValid
              }
            >
              {synthesizeOneShotMutation.isPending
                ? "Synthesizing..."
                : "Synthesize One-Shot"}
            </Button>
          </div>
        </form>
      </Form>

      <AudioHistory audioHistory={clips} />

      {synthesizeOneShotMutation.error && (
        <p className="text-red-500 mt-2">
          One-Shot Error: {synthesizeOneShotMutation.error.message}
        </p>
      )}
    </div>
  );
};

export default TestClient;
