"use client";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();

  return (
    <div className="relative mx-auto flex min-h-[80vh] w-full max-w-md flex-col items-center justify-center px-6 py-16">
      {/* Close */}
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-4 top-4"
        onClick={() => router.push("/")}
        aria-label="Close"
      >
        <X />
      </Button>

      <Card className="text-center">
        <CardHeader>
          <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-green-600" />
          <CardTitle className="text-2xl">Success</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {`Your subscription is now active.`}
          </p>
        </CardContent>

        <CardFooter>
          <Link
            href="/"
            className={buttonVariants({
              variant: "outline",
              className: "w-full",
            })}
          >
            Create New Audio File
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
