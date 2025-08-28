"use client";
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
import { Textarea } from "@workspace/ui/components/textarea";
import { useForm } from "react-hook-form";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { api } from "../trpc/react";

const FeedbackSchema = z.object({
  email: z.string().email("Please enter a valid email.").optional(),
  message: z.string().min(1, "Please enter your feedback or request."),
});

type FeedbackFormValues = z.infer<typeof FeedbackSchema>;

export function FeedbackForm() {
  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(FeedbackSchema),
    defaultValues: { email: "", message: "" },
    mode: "onChange",
  });

  const [submitted, setSubmitted] = useState(false);
  const supportMutation = api.support.submit.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  const onSubmit = (values: FeedbackFormValues) => {
    supportMutation.mutate({
      name: values.email || "Anonymous",
      description: values.message,
    });
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
        <div className="text-lg font-semibold mb-1">
          Thank you for your feedback!
        </div>
        <div className="text-gray-500">We appreciate your input.</div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (optional)</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Feedback or Help Request</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Describe your feedback or issue..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="flex-1 w-full"
          disabled={!form.formState.isValid || supportMutation.isPending}
        >
          {supportMutation.isPending ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </Form>
  );
}
