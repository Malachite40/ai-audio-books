"use client";
import { Button } from "@workspace/ui/components/button";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { RiGoogleFill } from "@remixicon/react";
import { ResponsiveModal } from "./resonpsive-modal";

// --- Schema ---
const FormSchema = z.object({
  name: z.string().min(2, "Please enter a name.").max(100),
  speakerId: z.string().uuid().min(1, "Please select a speaker."),
  text: z.string().min(1, "Please enter text to synthesize."),
  public: z.boolean(),
});

export function LoginRequiredDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Login">
      <div className="flex gap-2 mt-2">
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            authClient.signIn.social({
              provider: "google",
              callbackURL: window.location.href,
            });
          }}
          variant={"outline"}
          className="flex-1 items-center gap-2"
        >
          <RiGoogleFill className="opacity-60" size={16} />
          Login with Google
        </Button>
      </div>
    </ResponsiveModal>
  );
}
