"use client";

import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Languages } from "@workspace/trpc/client";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const SpeakerFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Please enter a name."),
  displayName: z.string().min(1, "Please enter a speaker name."),
  language: z.enum(Languages),
  order: z.coerce.number().min(0),
  exampleAudio: z.string().url("Please enter a valid URL.").or(z.literal("")),
});

export function AdminSpeakersCard() {
  const { data, refetch, isLoading } = api.speakers.fetchAll.useQuery();
  const [filterLanguage, setFilterLanguage] = useState<
    "ALL" | (typeof Languages)[number]
  >("ALL");

  const upsertSpeaker = api.speakers.upsert.useMutation({
    onSuccess: () => {
      refetch();
      cancelEdit();
    },
  });

  const removeSpeaker = api.speakers.remove.useMutation({
    onSuccess: () => refetch(),
  });

  const createExample = api.speakers.createExample.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const form = useForm<z.infer<typeof SpeakerFormSchema>>({
    resolver: zodResolver(SpeakerFormSchema),
    defaultValues: {
      id: undefined,
      name: "",
      displayName: "",
      language: Languages[0],
      exampleAudio: "",
      order: data ? data.speakers.length : 0,
    },
  });

  const onSubmit = (values: z.infer<typeof SpeakerFormSchema>) => {
    upsertSpeaker.mutate(values);
  };

  const startEdit = (id: string) => {
    const speaker = data?.speakers?.find((s) => s.id === id);
    if (speaker) {
      form.reset({
        id: speaker.id,
        name: speaker.name,
        displayName: speaker.displayName,
        language:
          (speaker.language as (typeof Languages)[number]) ?? Languages[0],
        exampleAudio: speaker.exampleAudio || "",
        order: speaker.order || (data && data.speakers.length && 0) || 0,
      });
    }
  };

  const cancelEdit = () => {
    form.reset({
      id: undefined,
      name: "",
      displayName: "",
      language: Languages[0],
      exampleAudio: "",
    });
  };

  // Helper to swap order between two speakers
  const swapSpeakerOrderByIds = (idA: string, idB: string) => {
    if (!data?.speakers) return;
    const speaker1 = data.speakers.find((s) => s.id === idA);
    const speaker2 = data.speakers.find((s) => s.id === idB);
    if (!speaker1 || !speaker2) return;

    const order1 = typeof speaker1.order === "number" ? speaker1.order : 0;
    const order2 = typeof speaker2.order === "number" ? speaker2.order : 0;

    upsertSpeaker.mutate(
      {
        ...speaker1,
        order: order2,
        exampleAudio: speaker1.exampleAudio ?? "",
        // language included if present in type
        language: (speaker1 as any).language ?? Languages[0],
        displayName: speaker1.displayName ?? "",
      },
      {
        onSuccess: () => {
          upsertSpeaker.mutate({
            ...speaker2,
            order: order1,
            exampleAudio: speaker2.exampleAudio ?? "",
            language: (speaker2 as any).language ?? Languages[0],
            displayName: speaker2.displayName ?? "",
          });
        },
      }
    );
  };

  const filteredSpeakers = useMemo(() => {
    const speakers = data?.speakers ?? [];
    if (filterLanguage === "ALL") return speakers;
    return speakers.filter((s) => (s as any).language === filterLanguage);
  }, [data, filterLanguage]);

  const swapWithPrev = (id: string) => {
    const idx = filteredSpeakers.findIndex((s) => s.id === id);
    if (idx > 0) {
      swapSpeakerOrderByIds(
        filteredSpeakers[idx]!.id,
        filteredSpeakers[idx - 1]!.id
      );
    }
  };

  const swapWithNext = (id: string) => {
    const idx = filteredSpeakers.findIndex((s) => s.id === id);
    if (idx > -1 && idx < filteredSpeakers.length - 1) {
      swapSpeakerOrderByIds(
        filteredSpeakers[idx]!.id,
        filteredSpeakers[idx + 1]!.id
      );
    }
  };

  return (
    <>
      <Card className="mb-6 p-4">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex gap-4 items-end"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Speaker Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter speaker name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue
                          className="capitalize"
                          placeholder="Select language"
                        />
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="exampleAudio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Audio Example URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter order" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={upsertSpeaker.isPending || !form.formState.isValid}
            >
              {form.getValues("id")
                ? upsertSpeaker.isPending
                  ? "Saving..."
                  : "Save"
                : upsertSpeaker.isPending
                  ? "Adding..."
                  : "Add Speaker"}
            </Button>
            {form.getValues("id") && (
              <Button type="button" variant="secondary" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </form>
        </Form>
      </Card>
      <Card className="p-4">
        <div className="flex items-end justify-between mb-2 gap-4 flex-wrap">
          <h2 className="text-xl font-semibold">Speakers</h2>
          <div className="flex items-end gap-2">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">
                Filter by language
              </span>
              <Select
                value={filterLanguage}
                onValueChange={(v) => setFilterLanguage(v as any)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All languages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {Languages.map((lang) => (
                    <SelectItem className="capitalize" key={lang} value={lang}>
                      {lang.toLocaleLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Table>
          <TableCaption>A list of all speakers.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead className="w-[200px]">Display Name</TableHead>
              <TableHead className="w-[140px]">Language</TableHead>
              <TableHead className="w-[100px]">Order</TableHead>
              <TableHead>Audio Example</TableHead>
              <TableHead className="w-[180px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>Loading...</TableCell>
              </TableRow>
            ) : filteredSpeakers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>No speakers found.</TableCell>
              </TableRow>
            ) : (
              filteredSpeakers.map((speaker, idx) => (
                <TableRow key={speaker.id} className="group">
                  <TableCell className="font-medium items-center">
                    <div className="flex justify-between items-center">
                      <span>{speaker.name}</span>
                      <span className="inline-flex flex-col ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 mb-1"
                          onClick={() => swapWithPrev(speaker.id)}
                          disabled={idx === 0 || !!form.getValues("id")}
                          aria-label="Move up"
                          tabIndex={-1}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => swapWithNext(speaker.id)}
                          disabled={
                            idx === filteredSpeakers.length - 1 ||
                            !!form.getValues("id")
                          }
                          aria-label="Move down"
                          tabIndex={-1}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{speaker.displayName ?? ""}</TableCell>
                  <TableCell>{speaker.language ?? Languages[0]}</TableCell>
                  <TableCell>{speaker.order}</TableCell>
                  <TableCell>
                    {speaker.exampleAudio ? (
                      <audio
                        controls
                        src={speaker.exampleAudio}
                        style={{ maxWidth: 200 }}
                      >
                        Your browser does not support the audio element.
                      </audio>
                    ) : (
                      <span className="text-gray-400">No audio</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(speaker.id)}
                      disabled={!!form.getValues("id")}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        createExample.mutate({ speakerId: speaker.id })
                      }
                      disabled={
                        createExample.isPending || !!form.getValues("id")
                      }
                      title="Create a public 1-sentence sample and set example URL"
                    >
                      {createExample.isPending ? "Creating…" : "Create Sample"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeSpeaker.mutate({ id: speaker.id })}
                      disabled={
                        removeSpeaker.isPending || !!form.getValues("id")
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
