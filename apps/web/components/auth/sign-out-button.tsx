"use client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";

export type SignOutButtonProps = {};

export function SignOutButton(props: SignOutButtonProps) {
  const router = useRouter();
  return (
    <Button
      onClick={async () => {
        await authClient.signOut();
        router.refresh();
      }}
      className="flex cursor-pointer items-center gap-2"
    >
      Sign Out
    </Button>
  );
}
