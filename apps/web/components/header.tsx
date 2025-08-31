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
import { DollarSign, HelpCircleIcon, LogOut } from "lucide-react";
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
        <div className="flex w-full justify-between items-center px-3 md:px-4 ">
          <Link href={"/"} className="flex gap-3 justify-center items-center">
            <Logo className="size-8 fill-foreground" />
            {userData && (
              <span className="font-semibold hidden md:flex">
                Instant Audio Online
              </span>
            )}
          </Link>
          <div className=""></div>
          <div className="flex sm:gap-1 justify-center items-center">
            {/* Upsell */}
            {(!subscriptionData?.subscription ||
              subscriptionData?.subscription?.plan === "FREE") && (
              <Fragment>
                <Button
                  onClick={() => {
                    setShowPricing(true);
                  }}
                  variant={"ghost"}
                  className="flex"
                >
                  {!subscriptionData?.subscription ? (
                    <>Pricing</>
                  ) : (
                    <span className="px-3 py-1 rounded-md drop-shadow-[0_0_10px_rgba(110,85,207,1)] text-primary">
                      Upgrade
                    </span>
                  )}
                </Button>
                <Divider />
              </Fragment>
            )}

            {/* User Menu */}
            {userData?.user ? (
              <Fragment>
                <AudioHistoryDrawer />
                <Divider />
                <Link
                  href={"/audio/new"}
                  className={buttonVariants({ variant: "ghost" })}
                >
                  New Audio
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
                    <DropdownMenuItem onSelect={() => router.push("/support")}>
                      <HelpCircleIcon className="size-4" />
                      <span>Support</span>
                    </DropdownMenuItem>
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
                variant={"ghost"}
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

function Divider() {
  return <div className="h-6 w-px bg-border self-center" />;
}
