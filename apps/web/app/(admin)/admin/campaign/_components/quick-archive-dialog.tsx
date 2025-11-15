"use client";

import { ResponsiveModal } from "@/components/resonpsive-modal";
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
import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const QuickArchiveSchema = z.object({
  score: z
    .number({
      required_error: "Please enter a score between 1 and 100.",
      invalid_type_error: "Please enter a score between 1 and 100.",
    })
    .min(1, "Please enter a score between 1 and 100.")
    .max(100, "Please enter a score between 1 and 100."),
});

type QuickArchiveFormValues = z.infer<typeof QuickArchiveSchema>;

export function QuickArchiveDialog({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const params = useParams();

  const form = useForm<QuickArchiveFormValues>({
    resolver: zodResolver(QuickArchiveSchema),
    defaultValues: { score: 0 },
    mode: "onChange",
  });

  const utils = api.useUtils();

  const quickArchive = api.reddit.evaluations.quickArchiveByScore.useMutation({
    onSuccess: (data, variables) => {
      utils.reddit.evaluations.fetchAll.invalidate();
      form.reset({ score: 50 });
      if (typeof data?.archived === "number") {
        toast.success(
          `Archived ${data.archived} evaluation${
            data.archived === 1 ? "" : "s"
          } below score ${variables?.maxScore}.`
        );
      } else {
        toast.success("Quick archive completed.");
      }
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to run quick archive.");
    },
  });

  const onSubmit = (values: QuickArchiveFormValues) => {
    if (!campaignId) {
      toast.error("Missing campaign id.");
      return;
    }

    quickArchive.mutate({
      campaignId,
      maxScore: values.score,
    });
  };

  const disabled =
    !campaignId ||
    quickArchive.isPending ||
    !form.formState.isValid ||
    form.formState.isSubmitting;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Archive"
      description="Automatically archive low-scoring evaluations for this campaign."
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <p className="text-sm text-muted-foreground">
            Archive all non-archived evaluations in this campaign with a score
            lower than the threshold you set. This cannot be easily undone.
          </p>
          <FormField
            control={form.control}
            name="score"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Archive evaluations with score below</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    placeholder="e.g. 60"
                    value={field.value === 0 ? "" : field.value}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "") {
                        field.onChange(0);
                        return;
                      }
                      const num = Number(value);
                      field.onChange(Number.isNaN(num) ? 0 : num);
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
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={quickArchive.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={disabled}>
              {quickArchive.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Archive"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveModal>
  );
}
