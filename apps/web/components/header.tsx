"use client";
import SubscribeClientPage from "@/app/(app)/subscribe/subscribe.client";
import Logo from "@/components/svgs/logo";
import { authClient } from "@/lib/auth-client";
import { api } from "@/trpc/react";
import { RiGoogleFill } from "@remixicon/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  AudioLinesIcon,
  CircleArrowUp,
  DollarSign,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { AudioHistoryDrawer } from "./audio-history-drawer";

export type HeaderProps = {};

export function Header(props: HeaderProps) {
  const router = useRouter();
  const [showPricing, setShowPricing] = useState(false);
  const { data: userData } = authClient.useSession();
  const { data: subscriptionData } = api.subscriptions.self.useQuery();

  return (
    <>
      {showPricing && (
        <div className="z-10 fixed top-0 left-0 h-dvh w-dvw  overflow-auto">
          <SubscribeClientPage setOpen={setShowPricing} />
        </div>
      )}
      <div className="h-12 z-1 flex w-full justify-center items-center border-b border-border top-0 sticky bg-background ">
        <div className="flex w-full justify-between items-center xl:p-0 px-2 md:px-4 ">
          <Link href={"/"} className="flex gap-2 justify-center items-center">
            <Logo className="size-10" />
            {userData && (
              <span className="font-semibold hidden md:flex">
                Instant Audio Online
              </span>
            )}
          </Link>
          <div className=""></div>
          <div className="flex gap-2 justify-center items-center">
            {/* credits */}

            {(!subscriptionData?.subscription ||
              subscriptionData?.subscription?.plan === "FREE") && (
              <Button
                onClick={() => {
                  setShowPricing(true);
                }}
                variant={"outline"}
                className="flex gap-2"
              >
                {!subscriptionData?.subscription ? (
                  <>Pricing</>
                ) : (
                  <>
                    <CircleArrowUp className="h-4 w-4" />
                    Upgrade
                  </>
                )}
              </Button>
            )}

            {userData?.user ? (
              <Fragment>
                <AudioHistoryDrawer />
                <Link
                  href={"/"}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <AudioLinesIcon className="h-4 w-4" />
                  Create
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar>
                      <AvatarImage src={userData.user.image ?? ""} />
                      <AvatarFallback>{userData.user.name[0]}</AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="" align="end">
                    {subscriptionData?.subscription?.plan !== "FREE" && (
                      <Link href={"/billing"}>
                        <DropdownMenuItem>
                          <DollarSign />
                          <span className="capitalize">Billing</span>
                        </DropdownMenuItem>
                      </Link>
                    )}
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
              </Fragment>
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
      </div>
    </>
  );
}
