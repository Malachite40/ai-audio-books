import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { useEffect, useMemo, useState } from "react";

import { format } from "date-fns";
import { Snapshot, useDebugMutationStore } from "./useDebugMutationStore";

export type DebugInfoCardProps = {};

// Snapshot type now imported from store

function downloadJson(filename: string, data: unknown) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Failed to download JSON", e);
  }
}

function SnapshotTable({
  title,
  snapshots,
}: {
  title: string;
  snapshots: Snapshot[];
}) {
  const preferredOrder = [
    "rssMB",
    "heapUsedMB",
    "heapTotalMB",
    "externalMB",
    "arrayBuffersMB",
  ] as const;

  const columns = useMemo(() => {
    const allKeys = new Set<string>();
    for (const s of snapshots) {
      Object.keys(s).forEach((k) => {
        if (k !== "raw" && k !== "date") allKeys.add(k); // exclude raw and date
      });
    }
    const extras = [...allKeys]
      .filter((k) => !preferredOrder.includes(k as any))
      .sort();
    return ["date", ...preferredOrder.filter((k) => allKeys.has(k)), ...extras];
  }, [snapshots]);

  return (
    <div className="w-full overflow-x-auto">
      <Table className="min-w-full">
        <TableCaption>{title}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[72px]">Index</TableHead>
            {columns.map((col) => (
              <TableHead key={col} className="whitespace-nowrap">
                {col === "date" ? "Date" : col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {snapshots.length > 0 ? (
            snapshots.map((snapshot, idx) => (
              <TableRow key={`row-${idx}`}>
                <TableCell className="whitespace-nowrap">{idx + 1}</TableCell>
                {columns.map((col) => {
                  let value = (snapshot as any)[col];
                  if (col === "date" && value)
                    value = format(new Date(value), "yy-MM-dd HH:mm:ss");
                  return (
                    <TableCell
                      key={`${idx}-${col}`}
                      className="align-top max-w-0"
                    >
                      <span className="text-sm break-all">
                        {value === undefined ? "" : String(value)}
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={1 + columns.length}
                className="text-muted-foreground text-center"
              >
                No data yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function DebugInfoCard(props: DebugInfoCardProps) {
  const queueBufferMutation = api.debug.queueHeapSnapshot.useMutation();
  const bufferMutation = api.debug.heapSnapshot.useMutation();

  const {
    queueHeapSnapshots,
    heapSnapshots,
    // replace arrays
    setQueueHeapSnapshots,
    setHeapSnapshots,
    // append single snapshot
    appendQueueHeapSnapshot,
    appendHeapSnapshot,
    // clear helpers
    clearQueueHeapSnapshots,
    clearHeapSnapshots,
    // optional global reset
    reset,
  } = useDebugMutationStore();

  // Display options
  const [maxEntries, setMaxEntries] = useState<number | "all">("all");
  const [newestFirst, setNewestFirst] = useState(true);

  // Save mutation results to zustand store

  useEffect(() => {
    const d = queueBufferMutation.data as
      | Record<string, unknown>[]
      | Record<string, unknown>
      | undefined;
    if (!d) return;
    if (Array.isArray(d)) {
      // Add date to each snapshot in array
      setQueueHeapSnapshots(
        d.map((snap) => ({ ...snap, date: new Date().toISOString() }))
      );
    } else {
      appendQueueHeapSnapshot(d);
    }
  }, [
    queueBufferMutation.data,
    setQueueHeapSnapshots,
    appendQueueHeapSnapshot,
  ]);

  useEffect(() => {
    const d = bufferMutation.data as
      | Record<string, unknown>[]
      | Record<string, unknown>
      | undefined;
    if (!d) return;
    if (Array.isArray(d)) {
      setHeapSnapshots(
        d.map((snap) => ({ ...snap, date: new Date().toISOString() }))
      );
    } else {
      appendHeapSnapshot(d);
    }
  }, [bufferMutation.data, setHeapSnapshots, appendHeapSnapshot]);

  const handleClick = () => {
    queueBufferMutation.mutate();
    bufferMutation.mutate();
  };

  const limitArray = (arr: Snapshot[]) => {
    const ordered = newestFirst ? [...arr].reverse() : arr;
    if (maxEntries === "all") return ordered;
    return ordered.slice(0, maxEntries);
  };

  const displayQueue = useMemo(
    () => limitArray(queueHeapSnapshots),
    [queueHeapSnapshots, maxEntries, newestFirst]
  );
  const displayHeap = useMemo(
    () => limitArray(heapSnapshots),
    [heapSnapshots, maxEntries, newestFirst]
  );

  const isLoading = queueBufferMutation.isPending || bufferMutation.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardTitle>Debug Tools</CardTitle>
          {isLoading && (
            <span className="text-xs text-muted-foreground">Capturing…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="maxEntries"
              className="text-sm text-muted-foreground"
            >
              Max entries
            </label>
            <input
              id="maxEntries"
              type="number"
              min={1}
              placeholder="all"
              className="h-9 w-20 rounded-md border bg-background px-2 text-sm"
              value={maxEntries === "all" ? "" : maxEntries}
              onChange={(e) => {
                const v = e.target.value;
                setMaxEntries(v === "" ? "all" : Math.max(1, Number(v)));
              }}
            />
          </div>
          <Button
            variant={newestFirst ? "default" : "secondary"}
            onClick={() => setNewestFirst((s) => !s)}
          >
            {newestFirst ? "Newest → Oldest" : "Oldest → Newest"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              clearQueueHeapSnapshots();
              clearHeapSnapshots();
            }}
          >
            Clear
          </Button>
          <Button onClick={handleClick} disabled={isLoading}>
            {isLoading ? "Capturing…" : "Take Heap Snapshot"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Queue Heap Snapshots</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  downloadJson(
                    `queue-heap-snapshots-${Date.now()}.json`,
                    queueHeapSnapshots
                  )
                }
              >
                Download JSON
              </Button>
              <Button variant="ghost" onClick={clearQueueHeapSnapshots}>
                Clear Only
              </Button>
            </div>
          </div>
          <SnapshotTable
            title="Queue Heap Snapshots"
            snapshots={displayQueue}
          />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Heap Snapshots</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  downloadJson(
                    `heap-snapshots-${Date.now()}.json`,
                    heapSnapshots
                  )
                }
              >
                Download JSON
              </Button>
              <Button variant="ghost" onClick={clearHeapSnapshots}>
                Clear Only
              </Button>
            </div>
          </div>
          <SnapshotTable title="Heap Snapshots" snapshots={displayHeap} />
        </section>
      </CardContent>
    </Card>
  );
}

export default DebugInfoCard;
