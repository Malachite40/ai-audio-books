"use client";

import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Progress } from "@workspace/ui/components/progress";
import { Slider } from "@workspace/ui/components/slider";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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

  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);

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

  // Purchase Credits Form
  const PurchaseFormSchema = z.object({
    quantity: z.number().min(1).max(10), // up to $100/10m at once
  });

  const purchaseForm = useForm<z.infer<typeof PurchaseFormSchema>>({
    resolver: zodResolver(PurchaseFormSchema),
    defaultValues: { quantity: 1 },
  });

  const quantity = purchaseForm.watch("quantity");
  const totalPrice = quantity * 10;
  const totalCredits = quantity * 1_000_000;

  // Use the purchase mutation from the API
  const purchaseMutation = api.credits.purchase.useMutation({
    onSuccess: ({ url }) => {
      router.push(url as any);
    },
    onError: (error) => {
      toast("Error", {
        description: error.message,
        duration: 6000,
      });
    },
  });

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

        <div className="w-full flex flex-col space-y-6">
          {/* Purchase Credits Modal Trigger */}
          <AlertDialog
            open={showPurchaseDialog}
            onOpenChange={setShowPurchaseDialog}
          >
            <AlertDialogTrigger asChild>
              <Button
                className="w-full mt-2"
                variant="outline"
                onClick={() => setShowPurchaseDialog(true)}
              >
                Purchase Credits
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Purchase Credits</AlertDialogTitle>
                <AlertDialogDescription>
                  Select the amount of credits you want to purchase. Each
                  increment is $10 for 1,000,000 characters.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Form {...purchaseForm}>
                <form
                  onSubmit={purchaseForm.handleSubmit((values) => {
                    purchaseMutation.mutate({
                      quantity: values.quantity,
                      success_url: window.location.href,
                      cancel_url: window.location.href,
                    });
                  })}
                  className="space-y-4"
                >
                  <FormField
                    control={purchaseForm.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credits to Purchase</FormLabel>
                        <FormControl>
                          <Slider
                            min={1}
                            max={10}
                            step={1}
                            value={[field.value]}
                            onValueChange={([val]) => field.onChange(val)}
                            className="w-full"
                          />
                        </FormControl>
                        <div className="flex justify-between text-xs mt-1">
                          <span>$10 / 1M</span>
                          <span>$100 / 10M</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="text-sm font-medium text-center">
                    <span>
                      {`Total: $${totalPrice} for ${formatNumber(totalCredits)} characters`}
                    </span>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      type="submit"
                      disabled={purchaseMutation.isPending}
                    >
                      {purchaseMutation.isPending
                        ? "Processing..."
                        : "Checkout"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </form>
              </Form>
            </AlertDialogContent>
          </AlertDialog>

          <div className="w-full flex h-px bg-border" />

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
    </div>
  );
}
