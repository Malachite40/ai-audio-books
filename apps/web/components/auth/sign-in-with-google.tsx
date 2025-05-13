"use client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";

export type SignInWithGoogleProps = {};

export function SignInWithGoogle(props: SignInWithGoogleProps) {
  return (
    <Button
      onClick={() => {
        authClient.signIn.social({
          provider: "google",
          callbackURL: window.location.href,
        });
      }}
      className="flex cursor-pointer items-center gap-2"
    >
      Login with Google
    </Button>
  );
}
