"use client";

import { ResponsiveModal } from "@/components/resonpsive-modal";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { RedditPost, RedditPostEvaluation } from "@workspace/database";
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
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

type CampaignExampleModalProps = {
  open: boolean;
  evaluation: RedditPostEvaluation;
  redditPost: RedditPost;
  onClose: () => void;
};

const CampaignExampleSchema = z.object({
  score: z
    .number({
      required_error: "Please enter a score between 1 and 100.",
      invalid_type_error: "Please enter a score between 1 and 100.",
    })
    .int()
    .min(1, "Score must be at least 1.")
    .max(100, "Score must be at most 100."),
  exampleMessage: z.string().min(1, "Please add some content before saving."),
  reasoning: z.string().optional(),
});

type CampaignExampleFormValues = z.infer<typeof CampaignExampleSchema>;

export function CampaignExampleModal({
  open,
  evaluation,
  redditPost,
  onClose,
}: CampaignExampleModalProps) {
  const utils = api.useUtils();
  const form = useForm<CampaignExampleFormValues>({
    resolver: zodResolver(CampaignExampleSchema),
    defaultValues: {
      score: evaluation.score ?? 75,
      exampleMessage: evaluation.exampleMessage ?? "",
      reasoning: evaluation.reasoning ?? "",
    },
    mode: "onChange",
  });

  const bookmarkEvaluation = api.reddit.evaluations.bookmark.useMutation({
    onSuccess: () => {
      utils.reddit.evaluations.fetchAll.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error("Failed to save example", {
        description: err.message,
      });
    },
  });

  const handleSubmit = (values: CampaignExampleFormValues) => {
    bookmarkEvaluation.mutate({
      evaluationId: evaluation.id,
      bookmarked: true,
      score: values.score,
      exampleMessage: values.exampleMessage.trim(),
      reasoning: values.reasoning?.trim() || undefined,
    });
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      title="Save example evaluation"
      description={redditPost.title}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
          aria-label="Save example evaluation"
        >
          <FormField
            control={form.control}
            name="score"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Example score (1-100)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    placeholder="1-100"
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "") {
                        field.onChange(NaN);
                        return;
                      }
                      const num = Number(value);
                      field.onChange(num);
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="exampleMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Example message</FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupTextarea
                      placeholder="Describe the curated answer or example response."
                      rows={7}
                      {...field}
                      value={field.value}
                    />
                    <InputGroupAddon align="block-end">
                      <InputGroupText className="flex w-full items-center justify-between text-xs text-muted-foreground">
                        <span>Existing message will be overwritten.</span>
                        <span>{field.value.trim().length} characters</span>
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reasoning"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reasoning (optional)</FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupTextarea
                      placeholder="Briefly explain why this is a good example / reasoning behind the score."
                      rows={5}
                      {...field}
                      value={field.value ?? ""}
                    />
                    <InputGroupAddon align="block-end">
                      <InputGroupText className="flex w-full items-center justify-between text-xs text-muted-foreground">
                        <span>Existing reasoning will be overwritten.</span>
                        <span>
                          {(field.value ?? "").trim().length} characters
                        </span>
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={bookmarkEvaluation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={bookmarkEvaluation.isPending || !form.formState.isValid}
            >
              {bookmarkEvaluation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveModal>
  );
}
