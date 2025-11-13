"use client";

import { useMemo } from "react";

import { api } from "@/trpc/react";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { Loader2, RefreshCw } from "lucide-react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

type CampaignEvaluationChartProps = {
  campaignId: string;
  days?: number;
};

export function CampaignEvaluationChart({
  campaignId,
  days = 30,
}: CampaignEvaluationChartProps) {
  const { data, isLoading, error } =
    api.reddit.getEvaluationTimeSeries.useQuery({
      campaignId,
      days,
    });

  const chartData = useMemo(() => {
    if (!data?.series) return [];
    return data.series.map((point) => ({
      date: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      evaluations: point.count,
    }));
  }, [data]);

  const total = useMemo(() => {
    return chartData.reduce((sum, point) => sum + point.evaluations, 0);
  }, [chartData]);

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-sm text-destructive">
          Failed to load chart: {error.message}
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading chart…
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between mb-4">
        <div>
          <h2 className="font-semibold text-lg">High-Score Evaluations</h2>
          <p className="text-sm text-muted-foreground">
            Posts with score ≥ 75 over the last {days} days
          </p>
        </div>
        <HeaderActions campaignId={campaignId} total={total} />
      </div>

      <ChartContainer
        config={{
          evaluations: {
            label: "High-Score Posts",
            // Make the line green by defining the series color here
            color: "hsl(142 70% 45%)",
          },
        }}
        className="h-64 w-full"
      >
        <LineChart
          data={chartData}
          // Reduce left padding to tighten the chart against the Y-axis
          margin={{ left: 0, right: 8, top: 8, bottom: 8 }}
        >
          {/* Remove background grid lines for a cleaner look */}
          <XAxis
            dataKey="date"
            tickMargin={6}
            angle={-45}
            textAnchor="end"
            height={60}
            fontSize={12}
          />
          <YAxis allowDecimals={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(label) => String(label)}
                formatter={(value) => (
                  <span className="font-mono">
                    {Number(value).toLocaleString()} posts
                  </span>
                )}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="evaluations"
            stroke="var(--color-evaluations)"
            strokeWidth={2}
            dot={false}
            activeDot={false}
          />
          <ChartLegend content={<ChartLegendContent />} />
        </LineChart>
      </ChartContainer>
    </Card>
  );
}

// Separate component so hooks remain at top-level of parent component file
function HeaderActions({
  campaignId,
  total,
}: {
  campaignId: string;
  total: number;
}) {
  const utils = api.useUtils();

  const { data: unscoredData } =
    api.reddit.countUnscoredPostsForCampaign.useQuery({
      campaignId,
    });
  const unscoredCount = unscoredData?.count ?? 0;

  const scoreUnscoredPosts =
    api.reddit.campaigns.adminQueueScorePosts.useMutation({
      onSuccess: () => {
        toast.success("Evaluation queued");
        utils.reddit.countUnscoredPostsForCampaign.invalidate({ campaignId });
      },
      onError: (err) =>
        toast.error("Failed to queue evaluation", { description: err.message }),
    });

  return (
    <div className="flex items-center gap-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Evaluate unscored posts"
            disabled={scoreUnscoredPosts.isPending || unscoredCount === 0}
            className={
              unscoredCount === 0 ? "opacity-50 cursor-not-allowed" : ""
            }
            onClick={() => {
              scoreUnscoredPosts.mutate({ campaignId });
            }}
          >
            {scoreUnscoredPosts.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{`Evaluate unscored posts (${unscoredCount})`}</TooltipContent>
      </Tooltip>
      <div className="text-right">
        <div className="text-2xl font-bold">{total}</div>
        <div className="text-xs text-muted-foreground">Total</div>
      </div>
    </div>
  );
}
