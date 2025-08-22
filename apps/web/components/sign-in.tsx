"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export type FullScreenSignInProps = {};

export function FullScreenSignIn(props: FullScreenSignInProps) {
  const { data: userData } = authClient.useSession();
  const router = useRouter();
  useEffect(() => {
    if (!userData?.user) return;

    router.refresh();
  }, [userData]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Button
        onClick={() => {
          authClient.signIn.social({
            provider: "google",
            callbackURL: window.location.href,
          });
        }}
        type="button"
      >
        Sign in to visit this page
      </Button>
    </div>
  );
}
