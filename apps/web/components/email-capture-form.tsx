"use client";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";

import { cn } from "@workspace/ui/lib/utils";
import { CircleCheck, Loader2, Mail, MoveRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const FormSchema = z.object({
  email: z.string().email(),
  group: z.string(),
});

export type EmailCaptureProps = {
  title: string;
  description: string;
  group: string;
};

export function EmailCaptureForm({
  title,
  description,
  group,
}: EmailCaptureProps) {
  const submit = api.emails.join.useMutation({
    onSuccess: () => {
      setSuccess(true);
    },
  });

  const [success, setSuccess] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      group,
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    submit.mutate(data);
  }
  return (
    <>
      <div className="flex w-full flex-col justify-center space-y-3">
        <div className="flex flex-col items-start w-full space-y-3">
          <div className="flex items-center text-3xl">
            <Mail className="mr-4 size-6 text-primary" strokeWidth={3} />

            <span className="text-xl text-white">{title}</span>
          </div>

          {description && (
            <span className="text-muted-foreground text-start">
              {description}
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          {!success ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex w-full flex-col items-start justify-start gap-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="flex w-full flex-col">
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  disabled={submit.isPending}
                  type="submit"
                  className="relative flex w-full items-center justify-center"
                >
                  <span
                    className={cn(
                      "flex items-center gap-2",
                      submit.isPending ? "opacity-0" : "opacity-100"
                    )}
                  >
                    <span>Subscribe</span>
                    <MoveRight className="size-4" />
                  </span>

                  {submit.isPending && (
                    <Loader2 className="absolute size-4 animate-spin" />
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <span className="flex items-center gap-2 p-4">
              <CircleCheck className="size-8 text-green-500" />
              <span className="text-green-500 font-semibold">
                Success, stay tuned!
              </span>
            </span>
          )}
        </div>
      </div>
    </>
  );
}
