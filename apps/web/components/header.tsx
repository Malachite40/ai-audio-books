"use client";
import { authClient } from "@/lib/auth-client";
import { RiGoogleFill } from "@remixicon/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export type HeaderProps = {};

export function Header(props: HeaderProps) {
  const { data: userData } = authClient.useSession();
  const router = useRouter();
  return (
    <div className="h-12 flex w-full justify-between items-center px-4 border-b border-border">
      <div className="text-lg font-semibold">Instant Audio Online</div>
      <div className=""></div>
      <div className="flex gap-2 justify-center items-center">
        {/* credits */}
        <div className=""></div>

        {/* Dropdown menu with Avatar as trigger and Login button */}
        {userData?.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar>
                <AvatarImage src={userData.user.image ?? ""} />
                <AvatarFallback>{userData.user.name[0]}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="" align="end">
              <DropdownMenuItem
                onClick={async () => {
                  await authClient.signOut();
                  router.refresh();
                }}
              >
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
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
            className="flex items-center gap-2"
          >
            <RiGoogleFill className="opacity-60" size={16} />
            Login with Google
          </Button>
        )}
      </div>
    </div>
  );
}
