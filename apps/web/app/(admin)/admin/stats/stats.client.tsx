"use client";

import { api } from "@/trpc/react";
import { Card } from "@workspace/ui/components/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@workspace/ui/components/chart";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function msToHours(ms: number) {
  const hours = ms / (1000 * 60 * 60);
  return `${hours.toFixed(1)}h`;
}

export function StatsClientPage() {
  const overview = api.stats.overview.useQuery();
  const usersByDay = api.stats.usersByDay.useQuery({ days: 30 });
  const audioByDay = api.stats.audioByDay.useQuery({ days: 30 });
  const breakdown = api.stats.processingBreakdown.useQuery();

  const usersSeries = (usersByDay.data ?? []).map((d) => ({
    date: d.date,
    users: d.count,
  }));
  const audioSeries = (audioByDay.data ?? []).map((d) => ({
    date: d.date,
    audio: d.count,
  }));

  const filesByStatus = (breakdown.data?.audioFilesByStatus ?? []).map((x) => ({
    status: x.status,
    count: x.count,
  }));

  const loading =
    overview.isLoading || usersByDay.isLoading || audioByDay.isLoading || breakdown.isLoading;

  const o = overview.data;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Stats</h1>
      <div className={cn("grid gap-4", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4")}> 
        <StatCard title="Total Users" value={o?.users.total ?? 0} loading={loading} />
        <StatCard title="Paid Users" value={(o?.users.paidTotal ?? 0)} loading={loading} />
        <StatCard title="BASIC Plan" value={(o?.users.paidByPlan.BASIC ?? 0)} loading={loading} />
        <StatCard title="PRO Plan" value={(o?.users.paidByPlan.PRO ?? 0)} loading={loading} />
        <StatCard title="Audio Files" value={o?.audio.totalFiles ?? 0} loading={loading} />
        <StatCard title="Processed Files" value={o?.audio.processedFiles ?? 0} loading={loading} />
        <StatCard
          title="Processed Duration"
          valueLabel={msToHours(o?.audio.processedDurationMs ?? 0)}
          value={o?.audio.processedDurationMs ?? 0}
          loading={loading}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-semibold mb-2">New Users (30d)</h2>
          <ChartContainer
            config={{ users: { label: "Users", color: "var(--color-chart-1)" } }}
            className="h-64"
          >
            <LineChart data={usersSeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickMargin={6} />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="users" stroke="var(--color-users)" strokeWidth={2} dot={false} />
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-2">New Audio Files (30d)</h2>
          <ChartContainer
            config={{ audio: { label: "Audio Files", color: "var(--color-chart-2)" } }}
            className="h-64"
          >
            <BarChart data={audioSeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickMargin={6} />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="audio" fill="var(--color-audio)" radius={[4, 4, 0, 0]} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Processing Breakdown</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {filesByStatus.map((s) => (
            <div key={s.status} className="space-y-1">
              <div className="text-sm text-muted-foreground">{s.status}</div>
              <div className="text-xl font-semibold">{s.count}</div>
              <Separator />
            </div>
          ))}
          {filesByStatus.length === 0 && (
            <div className="text-sm text-muted-foreground">No data</div>
          )}
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  valueLabel,
  loading,
}: {
  title: string;
  value?: number;
  valueLabel?: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold mt-1">
        {loading ? "…" : valueLabel ?? (value ?? 0).toLocaleString()}
      </div>
    </Card>
  );
}

