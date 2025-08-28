"use client";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import Link from "next/link";
import { ResponsiveModal } from "./resonpsive-modal";

export function NotEnoughCreditsDialog({
  open,
  onOpenChange,
  needed,
  available,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  needed: number;
  available: number;
}) {
  const deficit = Math.max(0, needed - available);
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Not enough credits"
      description="Your text exceeds your current credit balance."
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span>Required (chars)</span>
          <span className="font-medium">{needed.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span>Available</span>
          <span className="font-medium">{available.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between ">
          <span>Short by</span>
          <span className="font-semibold">{deficit.toLocaleString()}</span>
        </div>
        <div className="pt-2 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Link
            href="/billing"
            className={buttonVariants({ className: "flex-1" })}
          >
            Go to billing
          </Link>
        </div>
      </div>
    </ResponsiveModal>
  );
}
