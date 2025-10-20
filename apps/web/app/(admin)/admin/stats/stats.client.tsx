"use client";

import { api } from "@/trpc/react";
import { KpiSummaryCard } from "../_components/kpi-summary-card";
import { TabbedChartCard } from "../_components/tabbed-chart-card";
import { ProcessingBreakdownCard } from "../_components/processing-breakdown-card";

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

  const loading = overview.isLoading;
  const o = overview.data;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Stats</h1>
      <KpiSummaryCard overview={o} loading={loading} />

      <TabbedChartCard usersSeries={usersSeries} audioSeries={audioSeries} />

      <ProcessingBreakdownCard filesByStatus={filesByStatus} />
    </div>
  );
}
