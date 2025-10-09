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
import { useDebugMutationStore } from "./useDebugMutationStore";

export type DebugInfoCardProps = {};

// ---------- Utilities ----------
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

// Render-agnostic stringifier for cells
function fmtCell(value: unknown): string {
  if (value == null) return "";
  // Dates come in as ISO strings (we format them elsewhere)
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  // Pretty print small objects; truncate large ones
  try {
    const s = JSON.stringify(value);
    return s.length > 400 ? s.slice(0, 400) + "…" : s;
  } catch {
    return String(value);
  }
}

// ---------- Table ----------
function SnapshotTable({
  title,
  snapshots,
  prettyCols = [],
}: {
  title: string;
  snapshots: Array<Record<string, unknown>>;
  prettyCols?: string[];
}) {
  const preferredOrder = [
    "runtime",
    "rssMB",
    "heapUsedMB",
    "heapTotalMB",
    "externalMB",
    "arrayBuffersMB",
    "v8_usedMB",
    "v8_totalMB",
    "v8_limitMB",
  ] as const;

  const columns = useMemo(() => {
    const allKeys = new Set<string>();
    for (const s of snapshots) {
      Object.keys(s).forEach((k) => {
        if (k !== "raw" && k !== "procStatus" && k !== "procStatm")
          allKeys.add(k);
      });
    }
    const ordered = preferredOrder.filter((k) => allKeys.has(k as any));
    const extras = [...allKeys]
      .filter((k) => !ordered.includes(k as any) && k !== "date")
      .sort();
    return ["date", ...ordered, ...extras];
  }, [snapshots]);

  return (
    <div className="w-full overflow-x-auto">
      <Table className="min-w-full table-fixed">
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
                  let value: unknown = (snapshot as any)[col];
                  if (col === "date" && value)
                    value = format(
                      new Date(value as string),
                      "yy-MM-dd HH:mm:ss"
                    );
                  const isPretty =
                    value != null &&
                    (typeof value === "object" || Array.isArray(value)) &&
                    prettyCols.includes(col);
                  return (
                    <TableCell
                      key={`${idx}-${col}`}
                      className="align-top whitespace-pre-wrap"
                    >
                      {isPretty ? (
                        <pre className="text-xs leading-tight font-mono break-words whitespace-pre-wrap max-h-48 overflow-auto">
                          {(() => {
                            try {
                              return JSON.stringify(value, null, 2);
                            } catch {
                              return String(value);
                            }
                          })()}
                        </pre>
                      ) : (
                        <span className="text-sm break-words">{fmtCell(value)}</span>
                      )}
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
  // Existing mutations
  const queueBufferMutation = api.debug.queueHeapSnapshot.useMutation();
  const bufferMutation = api.debug.heapSnapshot.useMutation();
  // NEW: heap sanity cross-check
  const sanityMutation = api.debug.heapSanity.useMutation();

  const {
    queueHeapSnapshots,
    heapSnapshots,
    setQueueHeapSnapshots,
    setHeapSnapshots,
    appendQueueHeapSnapshot,
    appendHeapSnapshot,
    clearQueueHeapSnapshots,
    clearHeapSnapshots,
  } = useDebugMutationStore();

  // Local state for sanity snapshots to avoid changing your store shape
  const [sanitySnapshots, setSanitySnapshots] = useState<
    Record<string, unknown>[]
  >([]);

  // Display options
  const [maxEntries, setMaxEntries] = useState<number | "all">("all");
  const [newestFirst, setNewestFirst] = useState(true);

  // Wire queue snapshot results → store
  useEffect(() => {
    const d = queueBufferMutation.data as
      | Record<string, unknown>[]
      | Record<string, unknown>
      | undefined;
    if (!d) return;
    if (Array.isArray(d)) {
      setQueueHeapSnapshots(
        d.map((snap) => ({ ...snap, date: new Date().toISOString() }))
      );
    } else {
      appendQueueHeapSnapshot({ ...d, date: new Date().toISOString() });
    }
  }, [
    queueBufferMutation.data,
    setQueueHeapSnapshots,
    appendQueueHeapSnapshot,
  ]);

  // Wire heap snapshot results → store
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
      appendHeapSnapshot({ ...d, date: new Date().toISOString() });
    }
  }, [bufferMutation.data, setHeapSnapshots, appendHeapSnapshot]);

  // Wire sanity results → local state
  useEffect(() => {
    const d = sanityMutation?.data as
      | Record<string, unknown>[]
      | Record<string, unknown>
      | undefined;
    if (!d) return;
    if (Array.isArray(d)) {
      setSanitySnapshots(
        d.map((snap) => ({ ...snap, date: new Date().toISOString() }))
      );
    } else {
      setSanitySnapshots((prev) => [
        ...prev,
        { ...d, date: new Date().toISOString() },
      ]);
    }
  }, [sanityMutation?.data]);

  const handleClick = () => {
    queueBufferMutation.mutate();
    bufferMutation.mutate();
    sanityMutation?.mutate?.();
  };

  const limitArray = (arr: Array<Record<string, unknown>>) => {
    const ordered = newestFirst ? [...arr].reverse() : arr;
    if (maxEntries === "all") return ordered;
    return ordered.slice(0, maxEntries);
  };

  const displayQueue = useMemo(
    () =>
      limitArray(queueHeapSnapshots as unknown as Record<string, unknown>[]),
    [queueHeapSnapshots, maxEntries, newestFirst]
  );
  const displayHeap = useMemo(
    () => limitArray(heapSnapshots as unknown as Record<string, unknown>[]),
    [heapSnapshots, maxEntries, newestFirst]
  );
  const displaySanity = useMemo(
    () => limitArray(sanitySnapshots),
    [sanitySnapshots, maxEntries, newestFirst]
  );

  const isLoading =
    queueBufferMutation.isPending ||
    bufferMutation.isPending ||
    Boolean(sanityMutation?.isPending);

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
              setSanitySnapshots([]);
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

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Heap Sanity (V8 & OS Cross‑Check)</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  downloadJson(
                    `heap-sanity-${Date.now()}.json`,
                    sanitySnapshots
                  )
                }
              >
                Download JSON
              </Button>
              <Button variant="ghost" onClick={() => setSanitySnapshots([])}>
                Clear Only
              </Button>
              <Button
                onClick={() => sanityMutation?.mutate?.()}
                disabled={Boolean(sanityMutation?.isPending)}
              >
                {sanityMutation?.isPending
                  ? "Capturing…"
                  : "Take Sanity Snapshot"}
              </Button>
            </div>
          </div>
          <SnapshotTable
            title="Heap Sanity"
            snapshots={displaySanity}
            prettyCols={[
              "computed",
              "processMemoryUsage",
              "resourceUsage",
              "v8HeapSpaces",
              "v8HeapStatistics",
              "versions",
            ]}
          />
        </section>
      </CardContent>
    </Card>
  );
}

export default DebugInfoCard;
