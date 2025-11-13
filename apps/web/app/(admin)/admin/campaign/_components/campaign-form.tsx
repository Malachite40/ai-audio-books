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
                : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
