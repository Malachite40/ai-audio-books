"use client";

import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

export function MemoryStressCard() {
  const alloc2GB = api.debug.queueMemoryHogAlloc.useMutation();
  const alloc3GB = api.debug.queueMemoryHogAlloc.useMutation();
  const gcQueueMutation = api.debug.queueGarbageCleanup.useMutation();

  const anyPending =
    alloc2GB.isPending || alloc3GB.isPending || gcQueueMutation.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Memory Stress</CardTitle>
          <CardDescription>
            Allocate large blocks in the queue worker to simulate 2–3 GB memory
            usage, then free.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => alloc2GB.mutate({ mb: 2048 })}
            disabled={anyPending}
            title="Allocate ~2GB in worker"
          >
            {alloc2GB.isPending ? "Alloc 2GB…" : "Alloc 2GB"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => alloc3GB.mutate({ mb: 3072 })}
            disabled={anyPending}
            title="Allocate ~3GB in worker"
          >
            {alloc3GB.isPending ? "Alloc 3GB…" : "Alloc 3GB"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => gcQueueMutation.mutate()}
            disabled={anyPending}
            title="Trigger GC in worker"
          >
            {gcQueueMutation.isPending ? "Cleaning…" : "Garbage Cleanup"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Tip: After allocating, use Garbage Cleanup to encourage release.
          Actual limits depend on container/runtime.
        </p>
      </CardContent>
    </Card>
  );
}

export default MemoryStressCard;
