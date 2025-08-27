"use client";

import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export type BillingClientProps = {};

function formatNumber(n: number) {
  try {
    return n.toLocaleString();
  } catch {
    return String(n);
  }
}

export function BillingClient(props: BillingClientProps) {
  const router = useRouter();

  // Current subscription/plan
  const { data: subscriptionData, isLoading: subscriptionLoading } =
    api.subscriptions.self.useQuery();

  // Remaining credits
  const { data: creditsData, isLoading: creditsLoading } =
    api.credits.fetch.useQuery();

  // Stripe billing portal
  const createBillingPortal = api.stripe.billingPortal.useMutation({
    onSuccess: ({ url }) => {
      router.push(url as any);
    },
  });

  const plan = (subscriptionData?.subscription?.plan ?? "FREE") as
    | "FREE"
    | "BASIC"
    | "PRO";

  // Quotas per plan (characters)
  // BASIC: 1,000,000; PRO: 5,000,000
  const planTotal = useMemo(() => {
    if (plan === "BASIC") return 1_000_000;
    if (plan === "PRO") return 5_000_000;
    return 0; // FREE or unknown
  }, [plan]);

  const remaining = creditsData?.credits?.amount ?? 0;
  const progressValue = planTotal > 0 ? (remaining / planTotal) * 100 : 0;

  const label =
    planTotal > 0
      ? `${formatNumber(remaining)} / ${formatNumber(planTotal)}`
      : "No active plan";

  const isLoading = subscriptionLoading || creditsLoading;

  return (
    <div className="flex items-center justify-center w-full px-4">
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Characters remaining</span>
          <span className="text-sm tabular-nums opacity-80">{label}</span>
        </div>

        {/* Progress bar shows REMAINING percentage based on plan */}
        <div className="flex items-center gap-3">
          <Progress
            value={isLoading ? 0 : Math.max(0, Math.min(100, progressValue))}
            className="flex-1"
          />
          <span className="text-xs w-12 text-right tabular-nums">
            {isLoading
              ? "--%"
              : `${Math.round(Math.max(0, Math.min(100, progressValue)))}%`}
          </span>
        </div>

        <Button
          className="w-full"
          onClick={() =>
            createBillingPortal.mutate({
              return_url: window.location.href,
            })
          }
          disabled={createBillingPortal.isPending}
        >
          {createBillingPortal.isPending ? "Opening…" : "Manage Plan"}
        </Button>
      </div>
    </div>
  );
}
