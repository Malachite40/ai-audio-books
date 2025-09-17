import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useForm } from "react-hook-form";
import { z } from "zod";

const ReStitchFormSchema = z.object({
  audioFileId: z.string().min(1, "Please enter an audioFileId."),
});

export function ReStitchForm() {
  const form = useForm<z.infer<typeof ReStitchFormSchema>>({
    resolver: zodResolver(ReStitchFormSchema),
    defaultValues: { audioFileId: "" },
  });

  const queueConcat = api.audio.queueConcatAudioFile.useMutation();

  const onSubmit = (values: z.infer<typeof ReStitchFormSchema>) => {
    queueConcat.mutate({ audioFileId: values.audioFileId });
  };

  return (
    <Card className="p-4 mb-6">
      <h2 className="text-xl font-semibold mb-2">Re-Stitch Audio File</h2>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex gap-4 items-end"
        >
          <FormField
            control={form.control}
            name="audioFileId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Audio File ID</FormLabel>
                <FormControl>
                  <Input placeholder="Enter audioFileId" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={queueConcat.isPending || !form.formState.isValid}
          >
            {queueConcat.isPending ? "Queueing..." : "Queue Re-Stitch"}
          </Button>
        </form>
        {queueConcat.isSuccess && (
          <div className="mt-2 text-green-600">Queued successfully!</div>
        )}
        {queueConcat.isError && (
          <div className="mt-2 text-red-600">
            Error: {queueConcat.error?.message}
          </div>
        )}
      </Form>
    </Card>
  );
}
