"use client";

import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@workspace/ui/components/tabs";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ReStitchForm } from "./_components/re-stitch";
import { SupportSubmissionsCard } from "./_components/support-submissions-card";

const SpeakerFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Please enter a name."),
  order: z.coerce.number().min(0),
  exampleAudio: z.string().url("Please enter a valid URL.").or(z.literal("")),
});

export type AdminClientPageProps = {};

export function AdminClientPage(props: AdminClientPageProps) {
  const { data, refetch, isLoading } = api.speakers.fetchAll.useQuery();

  const upsertSpeaker = api.speakers.upsert.useMutation({
    onSuccess: () => {
      refetch();
      cancelEdit();
    },
  });

  const removeSpeaker = api.speakers.remove.useMutation({
    onSuccess: () => refetch(),
  });

  const form = useForm<z.infer<typeof SpeakerFormSchema>>({
    resolver: zodResolver(SpeakerFormSchema),
    defaultValues: {
      id: undefined,
      name: "",
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
        exampleAudio: speaker.exampleAudio || "",
        order: speaker.order || (data && data.speakers.length && 0) || 0,
      });
    }
  };

  const cancelEdit = () => {
    form.reset({ id: undefined, name: "", exampleAudio: "" });
  };

  // Helper to swap order between two speakers
  const swapSpeakerOrder = (index1: number, index2: number) => {
    if (!data?.speakers) return;
    const speakers = [...data.speakers];
    const speaker1 = speakers[index1];
    const speaker2 = speakers[index2];
    if (!speaker1 || !speaker2) return;

    // Ensure order is never null
    const order1 = typeof speaker1.order === "number" ? speaker1.order : 0;
    const order2 = typeof speaker2.order === "number" ? speaker2.order : 0;

    // Ensure exampleAudio is always a string
    upsertSpeaker.mutate(
      {
        ...speaker1,
        order: order2,
        exampleAudio: speaker1.exampleAudio ?? "",
      },
      {
        onSuccess: () => {
          upsertSpeaker.mutate({
            ...speaker2,
            order: order1,
            exampleAudio: speaker2.exampleAudio ?? "",
          });
        },
      }
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
      <Tabs defaultValue="speakers" className="w-full">
        <TabsList>
          <TabsTrigger value="speakers">Speakers</TabsTrigger>
          <TabsTrigger value="restitch">Re-Stitch Audio</TabsTrigger>
          <TabsTrigger value="support">Support Submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="speakers">
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
                      : "Save Changes"
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
            <h2 className="text-xl font-semibold mb-2">Speakers</h2>
            <Table>
              <TableCaption>A list of all speakers.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[100px]">Order</TableHead>
                  <TableHead>Audio Example</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="w-[180px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}>Loading...</TableCell>
                  </TableRow>
                ) : data?.speakers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>No speakers found.</TableCell>
                  </TableRow>
                ) : (
                  data?.speakers?.map((speaker, idx) => (
                    <TableRow
                      key={speaker.id}
                      className="group"
                    >
                      <TableCell className="font-medium items-center">
                        <div className="flex justify-between items-center">
                          <span>{speaker.name}</span>
                          <span className="inline-flex flex-col ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 mb-1"
                              onClick={() => swapSpeakerOrder(idx, idx - 1)}
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
                              onClick={() => swapSpeakerOrder(idx, idx + 1)}
                              disabled={
                                idx === data.speakers.length - 1 ||
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
                      <TableCell>{speaker.id}</TableCell>
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
        </TabsContent>
        <TabsContent value="restitch">
          <ReStitchForm />
        </TabsContent>
        <TabsContent value="support">
          <SupportSubmissionsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
