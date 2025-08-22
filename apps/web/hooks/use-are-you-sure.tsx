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
import { cn } from "@workspace/ui/lib/utils";
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
  const [showAreYouSure, setShowAreYouSure] = useState(false);
  const [object, setObject] = useState<T | undefined>(initialObject);

  function AreYouSure({
    title = "Are you sure?",
    description = "This action cannot be undone.",
    onConfirm,
    onCancel,
  }: AreYouSureProps) {
    return (
      <AlertDialog open={showAreYouSure} onOpenChange={setShowAreYouSure}>
        <AlertDialogTrigger asChild>
          <div className="hidden"></div>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {onCancel && (
              <AlertDialogCancel
                onClick={async () => {
                  onCancel();
                  setShowAreYouSure(false);
                }}
              >
                Cancel
              </AlertDialogCancel>
            )}
            {onConfirm && (
              <AlertDialogAction
                className={cn(buttonVariants({ variant: "destructive" }))}
                onClick={async () => {
                  onConfirm();
                  setShowAreYouSure(false);
                }}
              >
                Continue
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return {
    AreYouSure,
    setShowAreYouSure,
    showAreYouSure,
    setObject,
    object,
  };
}
