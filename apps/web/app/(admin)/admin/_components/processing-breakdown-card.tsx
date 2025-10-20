"use client";

import { Card } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";

export type StatusCount = { status: string; count: number };

export function ProcessingBreakdownCard({ filesByStatus }: { filesByStatus: StatusCount[] }) {
  return (
    <Card className="p-4">
      <h2 className="font-semibold mb-2">Processing Breakdown</h2>
      {filesByStatus.length === 0 ? (
        <div className="text-sm text-muted-foreground">No data</div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          {filesByStatus.map((s) => (
            <div key={s.status} className="space-y-1">
              <div className="text-sm text-muted-foreground">{s.status}</div>
              <div className="text-xl font-semibold">{s.count.toLocaleString()}</div>
              <Separator />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

