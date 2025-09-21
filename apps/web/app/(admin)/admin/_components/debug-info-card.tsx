import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

export type DebugInfoCardProps = {};

function KeyValueList({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="col-span-2 sm:col-span-1">
          <dt className="font-medium text-sm text-muted-foreground">{key}</dt>
          <dd className="text-sm">
            {typeof value === "object" ? (
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              String(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DebugInfoCard(props: DebugInfoCardProps) {
  const queueBufferMutation = api.debug.queueHeapSnapshot.useMutation();
  const bufferMutation = api.debug.heapSnapshot.useMutation();

  const handleClick = () => {
    queueBufferMutation.mutate();
    bufferMutation.mutate();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Debug Tools</CardTitle>
        <Button
          onClick={handleClick}
          disabled={queueBufferMutation.isPending || bufferMutation.isPending}
        >
          {queueBufferMutation.isPending || bufferMutation.isPending
            ? "Capturing..."
            : "Take Heap Snapshot"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-2">Queue Heap Snapshot</h2>
          {queueBufferMutation.data ? (
            <KeyValueList data={queueBufferMutation.data} />
          ) : (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Heap Snapshot</h2>
          {bufferMutation.data ? (
            <KeyValueList data={bufferMutation.data} />
          ) : (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
