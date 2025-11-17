"use client";

import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Campaign } from "@workspace/database";
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
import { Switch } from "@workspace/ui/components/switch";
import { Textarea } from "@workspace/ui/components/textarea";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const CampaignSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(120, "Name must be under 120 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(1000, "Description must be under 1000 characters"),
  isActive: z.boolean(),
  autoArchiveScore: z
    .number({
      required_error: "Please enter a score between 1 and 100.",
      invalid_type_error: "Please enter a score between 1 and 100.",
    })
    .int()
    .min(1, "Score must be at least 1.")
    .max(100, "Score must be at most 100.")
    .nullable()
    .optional(),
  model: z
    .string()
    .min(1, "Model id must be at least 1 character.")
    .max(255, "Model id must be under 255 characters.")
    .nullable()
    .optional(),
});

export type CampaignFormValues = z.infer<typeof CampaignSchema>;

interface CampaignFormProps {
  mode: "create" | "edit";
  campaign?: Campaign;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CampaignForm({
  mode,
  campaign,
  onSuccess,
  onCancel,
}: CampaignFormProps) {
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(CampaignSchema),
    defaultValues: {
      name: campaign?.name ?? "",
      description: campaign?.description ?? "",
      isActive: campaign?.isActive ?? true,
      autoArchiveScore: campaign?.autoArchiveScore ?? null,
      model: campaign?.model ?? null,
    },
    mode: "onChange",
  });

  const upsertMutation = api.reddit.campaigns.upsert.useMutation({
    onSuccess: () => {
      toast.success(
        mode === "create" ? "Campaign created" : "Campaign updated"
      );
      onSuccess?.();
    },
    onError: (err) =>
      toast.error(
        mode === "create"
          ? "Failed to create campaign"
          : "Failed to update campaign",
        { description: err.message }
      ),
  });

  const onSubmit = (values: CampaignFormValues) => {
    upsertMutation.mutate({ ...values, id: campaign?.id });
  };

  const pending = upsertMutation.isPending;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        aria-label={
          mode === "create" ? "Create campaign form" : "Edit campaign form"
        }
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  autoFocus
                  placeholder="e.g. AI Founders"
                  {...field}
                  value={field.value}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Describe the angle or audience for this campaign."
                  {...field}
                  value={field.value}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
              <div className="space-y-1">
                <FormLabel>Active</FormLabel>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Paused campaigns stay available but aren't suggested
                  elsewhere.
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label={
                    field.value ? "Campaign is active" : "Campaign is paused"
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="autoArchiveScore"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Auto-archive score threshold</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Optional, e.g. 60"
                  value={field.value == null ? "" : field.value}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "") {
                      field.onChange(null);
                      return;
                    }
                    const num = Number(value);
                    field.onChange(Number.isNaN(num) ? null : num);
                  }}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                New evaluations for this campaign will be archived by default
                when their score is below this threshold. Leave blank to disable
                auto-archiving.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>OpenRouter model</FormLabel>
              <Select
                value={field.value ?? ""}
                onValueChange={(value) =>
                  field.onChange(
                    value === "__DEFAULT_MODEL__" ? null : value
                  )
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Use default model" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__DEFAULT_MODEL__">
                    Use default model
                  </SelectItem>
                  <SelectItem value="anthropic/claude-sonnet-4.5">
                    anthropic/claude-sonnet-4.5
                  </SelectItem>
                  <SelectItem value="deepseek/deepseek-chat-v3.1:free">
                    deepseek/deepseek-chat-v3.1:free
                  </SelectItem>
                  <SelectItem value="deepseek/deepseek-v3.1-terminus">
                    deepseek/deepseek-v3.1-terminus
                  </SelectItem>
                  <SelectItem value="google/gemini-2.5-flash">
                    google/gemini-2.5-flash
                  </SelectItem>
                  <SelectItem value="google/gemini-2.5-flash-lite-preview-09-2025">
                    google/gemini-2.5-flash-lite-preview-09-2025
                  </SelectItem>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                  <SelectItem value="qwen/qwen3-30b-a3b">
                    qwen/qwen3-30b-a3b
                  </SelectItem>
                  <SelectItem value="x-ai/grok-4-fast">
                    x-ai/grok-4-fast
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Optional. When set, Reddit post evaluations for this campaign
                will use this OpenRouter model. Leave blank to use the default
                model.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-2">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={pending}
            >
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={pending || !form.formState.isValid}>
            {pending
              ? mode === "create"
                ? "Creating…"
                : "Saving…"
              : mode === "create"
                ? "Create"
                : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
