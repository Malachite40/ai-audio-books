"use client";
import { authClient } from "@/lib/auth-client";
import { api } from "@/trpc/react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { CheckIcon, Loader2, MinusIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import { featureNames, planFeatures } from "./pricing-plan-data";

/**
 * Instant Audio Online – Pricing
 * -----------------------------------------------------
 * Tailored from the provided template with IAO-specific plans & features.
 * - Plans: Free, Pay-as-you-go, Pro Publisher
 * - Key differentiator surfaced: paste-long-text → single polished audio
 */

export default function SubscribeClientPage() {
  const router = useRouter();
  const { data } = authClient.useSession();
  const stripeCreateCheckoutSessionMutation =
    api.stripe.createCheckoutSession.useMutation({
      onSuccess: ({ url }) => {
        router.push(url as any);
      },
    });

  return (
    <div className="relative flex w-full flex-col items-center justify-center p-6">
      <Button
        size={"icon"}
        variant={"ghost"}
        onClick={() => router.push("/")}
        className="absolute end-4 top-4"
        aria-label="Close pricing"
      >
        <X />
      </Button>

      <div className="container py-24 lg:py-32">
        {/* Heading */}
        <div className="mx-auto mb-10 max-w-2xl text-center lg:mb-14">
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight">
            Instant Audio Online Pricing
          </h2>
          <p className="mt-1 text-muted-foreground">
            Turn any text into a polished audiobook. Paste long text → get one
            seamless file.
          </p>
        </div>

        {/* Toggle (kept hidden but wired for future) */}
        <div className="flex hidden items-center justify-center">
          <Label htmlFor="payment-schedule" className="me-3">
            Monthly
          </Label>
          <Switch id="payment-schedule" />
          <Label htmlFor="payment-schedule" className="relative ms-3">
            Annual
            <span className="absolute -end-28 -top-10 start-auto">
              <span className="flex items-center">
                <svg
                  className="-me-6 h-8 w-14"
                  width={45}
                  height={25}
                  viewBox="0 0 45 25"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M43.2951 3.47877C43.8357 3.59191 44.3656 3.24541 44.4788 2.70484C44.5919 2.16427 44.2454 1.63433 43.7049 1.52119L43.2951 3.47877ZM4.63031 24.4936C4.90293 24.9739 5.51329 25.1423 5.99361 24.8697L13.8208 20.4272C14.3011 20.1546 14.4695 19.5443 14.1969 19.0639C13.9242 18.5836 13.3139 18.4152 12.8336 18.6879L5.87608 22.6367L1.92723 15.6792C1.65462 15.1989 1.04426 15.0305 0.563943 15.3031C0.0836291 15.5757 -0.0847477 16.1861 0.187863 16.6664L4.63031 24.4936ZM43.7049 1.52119C32.7389 -0.77401 23.9595 0.99522 17.3905 5.28788C10.8356 9.57127 6.58742 16.2977 4.53601 23.7341L6.46399 24.2659C8.41258 17.2023 12.4144 10.9287 18.4845 6.96211C24.5405 3.00476 32.7611 1.27399 43.2951 3.47877L43.7049 1.52119Z"
                    fill="currentColor"
                    className="text-muted-foreground"
                  />
                </svg>
                <Badge className="mt-3 uppercase">Save up to 10%</Badge>
              </span>
            </span>
          </Label>
        </div>
        {/* Pricing Cards */}
        <div className="mt-12 grid gap-6 md:grid-cols-3 lg:items-center">
          {/* Starter Card */}
          <Card>
            <CardHeader className="pb-2 text-center">
              <CardTitle className="mb-7">Starter</CardTitle>
              <span className="text-5xl font-bold">$0</span>
            </CardHeader>
            <CardDescription className="text-center">
              Get started with essential features for small projects.
            </CardDescription>
            <CardContent>
              <ul className="mt-7 space-y-2.5 text-sm">
                <li className="flex space-x-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    20k Characters / Month
                  </span>
                </li>
                <li className="flex space-x-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Unlimited Rollover
                  </span>
                </li>
                <li className="flex space-x-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Basic Chapter Detection
                  </span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button disabled className="w-full" variant={"outline"}>
                Enjoy for free!
              </Button>
            </CardFooter>
          </Card>

          {/* Basic Card */}
          <Card className="border-primary">
            <CardHeader className="pb-2 text-center">
              <Badge className="mb-3 w-max self-center uppercase">
                Most popular
              </Badge>
              <CardTitle className="!mb-7">Basic</CardTitle>
              <span className="flex w-full items-end justify-center gap-1">
                <span className="text-5xl font-bold">$12</span>
                <span className="text-muted-foreground">/mo</span>
              </span>
            </CardHeader>
            <CardDescription className="mx-auto w-11/12 text-center">
              Ideal for creators needing advanced features and greater capacity.
            </CardDescription>
            <CardContent>
              <ul className="mt-7 space-y-2.5 text-sm">
                <li className="flex space-x-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    1M Characters/Month (~25h audio)
                  </span>
                </li>
                <li className="flex space-x-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Smart Chapter Detection & Auto-Stitching
                  </span>
                </li>
                <li className="flex space-x-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    API Access & Advanced SSML Controls
                  </span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                disabled={stripeCreateCheckoutSessionMutation.isPending}
                onClick={() => {
                  if (!data?.user) {
                    authClient.signIn.social({ provider: "google" });
                    return;
                  }
                  stripeCreateCheckoutSessionMutation.mutate({
                    product: "basic",
                  });
                }}
              >
                {stripeCreateCheckoutSessionMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Upgrade to Basic"
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Card */}
          <Card>
            <CardHeader className="pb-2 text-center">
              <CardTitle className="mb-7">Pro</CardTitle>
              <span className="flex w-full items-end justify-center gap-1">
                <span className="text-5xl font-bold">$40</span>
                <span className="text-muted-foreground">/mo</span>
              </span>
            </CardHeader>
            <CardDescription className="mx-auto w-11/12 text-center">
              For heavy users and teams needing premium, high-performance
              features.
            </CardDescription>
            <CardContent>
              <ul className="mt-7 space-y-2.5 text-sm">
                <li className="flex space-x-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    5M Characters/Month (~125h audio)
                  </span>
                </li>
                <li className="flex space-x-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Smart + TOC Chapter Detection
                  </span>
                </li>
                <li className="flex space-x-2">
                  <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Premium Voice Library & Custom Voices
                  </span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={"outline"}
                disabled={stripeCreateCheckoutSessionMutation.isPending}
                onClick={() => {
                  if (!data?.user) {
                    authClient.signIn.social({ provider: "google" });
                    return;
                  }
                  stripeCreateCheckoutSessionMutation.mutate({
                    product: "pro",
                  });
                }}
              >
                {stripeCreateCheckoutSessionMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Start Pro"
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Compare plans */}
        <div className="mt-20 lg:mt-32">
          <div className="mb-10 lg:mb-20 lg:text-center">
            <h3 className="text-2xl font-semibold dark:text-white">
              Compare plans
            </h3>
          </div>

          {/* Desktop table */}
          <Table className="hidden lg:table">
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead className="w-3/12 text-primary">Features</TableHead>
                <TableHead className="w-2/12 text-center text-lg font-medium text-primary">
                  Free
                </TableHead>
                <TableHead className="w-2/12 text-center text-lg font-medium text-primary">
                  Basic
                </TableHead>
                <TableHead className="w-2/12 text-center text-lg font-medium text-primary">
                  Pro
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featureNames.map((feature) => {
                const freeFeature = planFeatures[0]?.features.find(
                  (f) => f.name === feature
                );
                const paygFeature = planFeatures[1]?.features.find(
                  (f) => f.name === feature
                );
                const proFeature = planFeatures[2]?.features.find(
                  (f) => f.name === feature
                );
                return (
                  <TableRow key={feature} className="text-muted-foreground">
                    <TableCell>{feature}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {freeFeature && freeFeature?.value ? (
                          <div>{freeFeature.value}</div>
                        ) : freeFeature ? (
                          <CheckIcon className="h-5 w-5 text-primary" />
                        ) : (
                          <MinusIcon className="h-5 w-5" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {paygFeature && paygFeature?.value ? (
                          <div>{paygFeature.value}</div>
                        ) : paygFeature ? (
                          <CheckIcon className="h-5 w-5 text-primary" />
                        ) : (
                          <MinusIcon className="h-5 w-5" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {proFeature && proFeature?.value ? (
                          <div>{proFeature.value}</div>
                        ) : proFeature ? (
                          <CheckIcon className="h-5 w-5 text-primary" />
                        ) : (
                          <MinusIcon className="h-5 w-5" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Mobile stacked tables */}
          <div className="space-y-24 lg:hidden">
            <Table>
              {planFeatures.map((featureType) => (
                <React.Fragment key={featureType.type}>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableCell
                      colSpan={2}
                      className="w-10/12 font-bold text-primary"
                    >
                      {featureType.type}
                    </TableCell>
                  </TableRow>
                  {featureType.features.map((feature) => (
                    <TableRow
                      className="text-muted-foreground"
                      key={feature.name}
                    >
                      <TableCell className="w-11/12">
                        {feature.name}
                        {feature.value ? (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                            {feature.value}
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </Table>
          </div>

          {/* Footnote */}
          <p className="mt-6 text-xs text-muted-foreground">
            * "Unlimited" length is subject to fair use limits to prevent abuse;
            extremely large jobs may be split automatically but are stitched
            into a single export.
          </p>
        </div>
      </div>
    </div>
  );
}
