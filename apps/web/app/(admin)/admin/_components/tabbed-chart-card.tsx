"use client";

import { Card } from "@workspace/ui/components/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

type SeriesPoint = { date: string; users?: number; audio?: number };

export function TabbedChartCard({ usersSeries, audioSeries }: { usersSeries: SeriesPoint[]; audioSeries: SeriesPoint[] }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Trends (30d)</h2>
        <div className="text-xs text-muted-foreground">Daily totals</div>
      </div>
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <div>
          <div className="font-medium mb-2">New Users</div>
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
        </div>
        <div>
          <div className="font-medium mb-2">New Audio Files</div>
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
        </div>
      </div>
    </Card>
  );
}
