"use client";

import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import { useState } from "react";

export type useAreYouSureProps<T> = {
  initialObject?: T;
};

export type AreYouSureProps = {
  title?: string;
  description?: string;
  isPending?: boolean;
  onConfirm?: () => Promise<void>;
  onCancel?: () => Promise<void>;
};

export function useAreYouSure<T>({
  initialObject,
}: useAreYouSureProps<T> = {}) {
  const [open, setOpen] = useState(false);
  const [object, setObject] = useState<T | undefined>(initialObject);

  function AreYouSure({
    title = "Are you sure?",
    description = "This action cannot be undone.",
    onConfirm,
    onCancel,
    isPending,
  }: AreYouSureProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const handleConfirm = async () => {
      if (onConfirm) await onConfirm();
      setOpen(false);
    };
    const handleCancel = async () => {
      if (onCancel) await onCancel();
      setOpen(false);
    };
    if (isDesktop) {
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <div className="hidden" />
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              {onCancel && (
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              )}
              {onConfirm && (
                <Button
                  className="flex-1"
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={isPending}
                >
                  Confirm
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      );
    }
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <div className="hidden" />
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="flex justify-end gap-2 mt-4 p-4">
            {onCancel && (
              <Button
                className="flex-1"
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            )}
            {onConfirm && (
              <Button
                className="flex-1"
                variant="destructive"
                onClick={handleConfirm}
                disabled={isPending}
              >
                Confirm
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return {
    AreYouSure,
    setShowAreYouSure: setOpen,
    showAreYouSure: open,
    setObject,
    object,
  };
}
