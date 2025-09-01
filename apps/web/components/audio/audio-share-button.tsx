"use client";

import { Button } from "@workspace/ui/components/button";

// Forms
import { ShareIcon } from "lucide-react/icons";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { toast } from "sonner";

export function ShareButton() {
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch (e) {
        // User cancelled or error
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast("Link copied to clipboard");
      } catch (e) {
        toast("Failed to copy link");
      }
    }
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" onClick={handleShare}>
          <ShareIcon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Share Audio Book</p>
      </TooltipContent>
    </Tooltip>
  );
}
