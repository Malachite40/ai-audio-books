"use client";

import { Card } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import type { RouterOutputs } from "@/trpc/react";

type Overview = RouterOutputs["stats"]["overview"] | undefined;

function msToHours(ms: number) {
  const hours = ms / (1000 * 60 * 60);
  return `${hours.toFixed(1)}h`;
}

export function KpiSummaryCard({ overview, loading }: { overview: Overview; loading?: boolean }) {
  const usersTotal = overview?.users.total ?? 0;
  const paidTotal = overview?.users.paidTotal ?? 0;
  const paidBasic = overview?.users.paidByPlan.BASIC ?? 0;
  const paidPro = overview?.users.paidByPlan.PRO ?? 0;

  const audioTotal = overview?.audio.totalFiles ?? 0;
  const processedFiles = overview?.audio.processedFiles ?? 0;
  const processedDurationMs = overview?.audio.processedDurationMs ?? 0;

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="font-semibold">Summary</h2>
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-4">
        <KpiItem
          label="Users"
          primary={loading ? undefined : usersTotal.toLocaleString()}
          secondary={loading ? undefined : `Paid: ${paidTotal.toLocaleString()} (BASIC ${paidBasic.toLocaleString()}, PRO ${paidPro.toLocaleString()})`}
          loading={loading}
        />
        <KpiItem
          label="Audio Files"
          primary={loading ? undefined : audioTotal.toLocaleString()}
          secondary={loading ? undefined : `Processed: ${processedFiles.toLocaleString()}`}
          loading={loading}
        />
        <KpiItem
          label="Processed Duration"
          primary={loading ? undefined : msToHours(processedDurationMs)}
          secondary={loading ? undefined : `${processedDurationMs.toLocaleString()} ms`}
          loading={loading}
        />
        {/* Placeholder for future KPI */}
        <KpiItem label="" primary={loading ? undefined : ""} secondary={undefined} loading={loading} hiddenOnEmpty />
      </div>
    </Card>
  );
}

function KpiItem({
  label,
  primary,
  secondary,
  loading,
  hiddenOnEmpty,
}: {
  label: string;
  primary?: string;
  secondary?: string;
  loading?: boolean;
  hiddenOnEmpty?: boolean;
}) {
  if (hiddenOnEmpty && !label && !primary && !secondary) return <div className="hidden md:block" />;

  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground min-h-4">
        {loading ? <Skeleton className="h-4 w-24" /> : label}
      </div>
      <div className="text-2xl font-semibold min-h-7">
        {loading ? <Skeleton className="h-7 w-20" /> : primary ?? "—"}
      </div>
      <div className="text-xs text-muted-foreground min-h-4">
        {loading ? <Skeleton className="h-4 w-40" /> : secondary}
      </div>
    </div>
  );
}

