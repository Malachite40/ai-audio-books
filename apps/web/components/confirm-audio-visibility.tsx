// components/confirm-audio-visibility.tsx
"use client";

import * as React from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { MEDIA_QUERY } from "@/lib/constants";
import { useAudioVisibilityPrefStore } from "@/store/use-audio-visibility-pref";
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
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
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
  onConfirm?: (args: {
    isPublic: boolean;
    saveChoice?: boolean;
  }) => Promise<void> | void;
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
  const isDesktop = useMediaQuery(MEDIA_QUERY.MD);
  // Persisted preference (null means not set yet)
  const preferredIsPublic = useAudioVisibilityPrefStore(
    (s) => s.preferredIsPublic
  );
  const setPreferredIsPublic = useAudioVisibilityPrefStore(
    (s) => s.setPreferredIsPublic
  );

  // Support controlled OR uncontrolled public toggle
  const [internalIsPublic, setInternalIsPublic] = React.useState<boolean>(
    preferredIsPublic ?? defaultIsPublic
  );

  // Local state for "Save my choice" checkbox
  const [saveChoice, setSaveChoice] = React.useState<boolean>(false);

  // When dialog opens, reset the uncontrolled value, favoring saved preference if present
  React.useEffect(() => {
    if (open && isPublic === undefined) {
      setInternalIsPublic(
        preferredIsPublic !== null ? preferredIsPublic : defaultIsPublic
      );
      setSaveChoice(false);
    }
  }, [open, defaultIsPublic, isPublic, preferredIsPublic]);

  const publicValue = isPublic ?? internalIsPublic;
  const setPublicValue = onIsPublicChange ?? setInternalIsPublic;

  const handleConfirm = async () => {
    try {
      if (saveChoice) {
        setPreferredIsPublic(publicValue);
      }
      await onConfirm?.({ isPublic: publicValue, saveChoice });
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

  if (isDesktop) {
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
          {/* Save my choice checkbox (layout-matched) */}
          <Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="save-choice"
              checked={saveChoice}
              onCheckedChange={(v) => setSaveChoice(!!v)}
              disabled={isPending}
              className=""
            />
            <div className="grid gap-1.5 font-normal">
              <p className="text-sm leading-none font-medium">Save my choice</p>
            </div>
          </Label>
          <AlertDialogFooter>
            {onCancel && (
              <AlertDialogCancel onClick={handleCancel} disabled={isPending}>
                {cancelLabel}
              </AlertDialogCancel>
            )}
            {onConfirm && (
              <AlertDialogAction
                className={cn(buttonVariants({ variant: "default" }))}
                onClick={handleConfirm}
                disabled={isPending}
              >
                {confirmLabel}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  // Mobile: Drawer
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        {trigger ?? <div className="hidden" />}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 p-4">
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
          <Label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="save-choice"
              checked={saveChoice}
              onCheckedChange={(v) => setSaveChoice(!!v)}
              disabled={isPending}
              className=""
            />
            <div className="grid gap-1.5 font-normal">
              <p className="text-sm leading-none font-medium">Save my choice</p>
            </div>
          </Label>
          <div className="flex gap-2">
            {onCancel && (
              <Button
                variant="outline"
                className={cn("flex-1")}
                onClick={handleCancel}
                disabled={isPending}
              >
                {cancelLabel}
              </Button>
            )}
            {onConfirm && (
              <Button
                className={cn("flex-1")}
                onClick={handleConfirm}
                disabled={isPending}
              >
                {confirmLabel}
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
