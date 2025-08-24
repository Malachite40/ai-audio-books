import * as React from "react";

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
import { buttonVariants } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { cn } from "@workspace/ui/lib/utils";

export type ConfirmAudioVisibilityProps = {
  /** Controls the dialog visibility */
  open: boolean;
  /** Called when dialog requests to change visibility (e.g., trigger/cancel/confirm/escape) */
  onOpenChange: (open: boolean) => void;

  /** Optional trigger element; if provided, it will open the dialog */
  trigger?: React.ReactNode;

  /** Heading & copy */
  title?: string;
  description?: string;

  /** Disable actions & toggle when pending */
  isPending?: boolean;

  /** Uncontrolled public toggle (initial value) */
  defaultIsPublic?: boolean;
  /** Controlled public toggle value (if you want to control it from parent) */
  isPublic?: boolean;
  /** Controlled public toggle change handler */
  onIsPublicChange?: (value: boolean) => void;

  /** Action handlers */
  onConfirm?: (args: { isPublic: boolean }) => Promise<void> | void;
  onCancel?: () => Promise<void> | void;

  /** Labels */
  confirmLabel?: string;
  cancelLabel?: string;

  /** Optional className for the dialog content */
  className?: string;
};

export function ConfirmAudioVisibility({
  open,
  onOpenChange,
  trigger,

  title = "Share audio?",
  description = "By default we will not share your audio files.",

  isPending = false,

  defaultIsPublic = false,
  isPublic,
  onIsPublicChange,

  onConfirm,
  onCancel,

  confirmLabel = "Continue",
  cancelLabel = "Cancel",

  className,
}: ConfirmAudioVisibilityProps) {
  // Support controlled OR uncontrolled public toggle
  const [internalIsPublic, setInternalIsPublic] =
    React.useState<boolean>(defaultIsPublic);

  // When dialog opens, reset the uncontrolled value to default
  React.useEffect(() => {
    if (open && isPublic === undefined) {
      setInternalIsPublic(defaultIsPublic);
    }
  }, [open, defaultIsPublic, isPublic]);

  const publicValue = isPublic ?? internalIsPublic;
  const setPublicValue = onIsPublicChange ?? setInternalIsPublic;

  const handleConfirm = async () => {
    try {
      await onConfirm?.({ isPublic: publicValue });
    } finally {
      onOpenChange(false);
    }
  };

  const handleCancel = async () => {
    try {
      await onCancel?.();
    } finally {
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : null}

      <AlertDialogContent className={className}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {/* Visibility toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-1">
            <Label htmlFor="audio-public-toggle" className="text-base">
              Make audio public
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, the audio will be accessible to others.
            </p>
          </div>
          <Switch
            id="audio-public-toggle"
            checked={publicValue}
            onCheckedChange={setPublicValue}
            disabled={isPending}
            aria-label="Toggle to make the audio public"
          />
        </div>

        <AlertDialogFooter>
          {onConfirm && (
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "default" }))}
              onClick={handleConfirm}
              disabled={isPending}
            >
              {confirmLabel}
            </AlertDialogAction>
          )}
          {onCancel && (
            <AlertDialogCancel onClick={handleCancel} disabled={isPending}>
              {cancelLabel}
            </AlertDialogCancel>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
