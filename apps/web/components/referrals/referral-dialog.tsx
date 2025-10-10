"use client";
import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import { CreditCard, MousePointerClick, Percent, UserPlus } from "lucide-react";
import CopyButton from "../copy-button";
import { ResponsiveModal } from "../resonpsive-modal";

export function ReferralDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data, isLoading } = api.referrals.getOrCreateMyLink.useQuery(
    undefined,
    { enabled: open }
  );
  const stats = api.referrals.getMyStats.useQuery(undefined, {
    enabled: !!data,
  });

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Refer & Earn"
      description="Share your link. Earn 100,000 credits when a friend becomes paid."
    >
      <div className="space-y-3 text-sm">
        <div className="flex-col items-center justify-between border-b border-border pb-2">
          <span>Your referral link</span>
          <div className="flex items-center gap-2 justify-between">
            <span className="font-mono text-xs  truncate">
              {isLoading ? "…" : data?.url}
            </span>
            <CopyButton text={data?.url ?? ""} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Clicks"
            value={stats.data?.clicks ?? 0}
            icon={
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            }
          />
          <Stat
            label="Signups"
            value={stats.data?.signups ?? 0}
            icon={<UserPlus className="h-4 w-4 text-muted-foreground" />}
          />
          <Stat
            label="Signup rate"
            value={percent(stats.data?.signupRate)}
            icon={<Percent className="h-4 w-4 text-muted-foreground" />}
          />
          <Stat
            label="Paid rate"
            value={percent(stats.data?.paidRate)}
            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
          />
          <div className="col-span-2 flex items-center justify-between border-t pt-2">
            <span className="flex items-center gap-2">Total bonus credits</span>
            <span className="font-semibold">
              {(stats.data?.totalBonusCredits ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="pt-2 flex gap-2">
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border border-border rounded-xl px-3 py-2">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="font-medium">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

function percent(n?: number) {
  return `${Math.round((n ?? 0) * 100)}%`;
}
