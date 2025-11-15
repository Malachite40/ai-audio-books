"use client";

import { format, formatDistanceToNow } from "date-fns";
import { useMemo, useState } from "react";

import { api } from "@/trpc/react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { Loader2, RefreshCw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";

type CampaignEvaluationChartProps = {
  campaignId: string;
  days?: number;
};

export function CampaignEvaluationChart({
  campaignId,
  days = 30,
}: CampaignEvaluationChartProps) {
  const [rangeDays, setRangeDays] = useState<number>(days);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(
    () => new Set()
  );

  const { data, isLoading, error } =
    api.reddit.evaluations.getTimeSeries.useQuery({
      campaignId,
      days: rangeDays,
    });

  const chartData = useMemo(() => {
    if (!data?.series) return [];
    const subreddits = new Set<string>();

    for (const point of data.series) {
      Object.keys(point.subreddits ?? {}).forEach((sub) => subreddits.add(sub));
    }

    return data.series.map((point) => {
      const row: Record<string, string | number> = {
        date: point.date,
        total: point.total ?? 0,
      };

      for (const subreddit of subreddits) {
        row[subreddit] = point.subreddits?.[subreddit] ?? 0;
      }

      return row;
    });
  }, [data]);

  const total = useMemo(() => {
    return chartData.reduce(
      (sum, point) => sum + (Number(point.total) || 0),
      0
    );
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
      <Card className="p-6 min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
          <Loader2 className="size-4 animate-spin" />
          Loading chart…
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 ">
      <div className="flex justify-between mb-4">
        <div>
          <h2 className="font-semibold text-lg">High-Score Evaluations</h2>
          <p className="text-sm text-muted-foreground">
            Posts with score ≥ 75 over the last {rangeDays} days
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={String(rangeDays)}
            onValueChange={(value) => {
              if (!value) return;
              const parsed = Number(value);
              if (!Number.isNaN(parsed)) {
                setRangeDays(parsed);
              }
            }}
            aria-label="Select time range"
          >
            <ToggleGroupItem value="7">7d</ToggleGroupItem>
            <ToggleGroupItem value="30">30d</ToggleGroupItem>
            <ToggleGroupItem value="90">90d</ToggleGroupItem>
          </ToggleGroup>
          <HeaderActions campaignId={campaignId} total={total} />
        </div>
      </div>

      <ChartContainer
        config={
          // `ChartContainer` expects a config object keyed by dataKey.
          // We'll add `total` (green) plus one entry per subreddit based on
          // the series payload, falling back to a simple total-only config
          // if the data isn't available yet.
          (() => {
            if (!data?.series?.length) {
              return {
                total: {
                  label: "Total High-Score Posts",
                  color: "hsl(142 70% 45%)",
                },
              } as const;
            }

            const subreddits = new Set<string>();
            for (const point of data.series) {
              Object.keys(point.subreddits ?? {}).forEach((sub) =>
                subreddits.add(sub)
              );
            }

            const baseConfig: Record<
              string,
              { label: string; color?: string }
            > = {
              total: {
                label: "Total (all subreddits)",
                color: "hsl(142 70% 45%)",
              },
            };

            const palette = [
              "hsl(210 80% 60%)",
              "hsl(25 90% 55%)",
              "hsl(280 70% 60%)",
              "hsl(190 75% 55%)",
              "hsl(340 75% 60%)",
            ];

            Array.from(subreddits)
              .sort()
              .forEach((subreddit, index) => {
                baseConfig[subreddit] = {
                  label: `r/${subreddit}`,
                  color: palette[index % palette.length],
                };
              });

            return baseConfig;
          })()
        }
        className="h-64 w-full"
      >
        <AreaChart
          data={chartData}
          // Reduce left padding to tighten the chart against the Y-axis
          margin={{ left: 0, right: 8, top: 8, bottom: 8 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickMargin={6}
            angle={-45}
            textAnchor="end"
            height={60}
            fontSize={12}
            tickFormatter={(value) =>
              formatDistanceToNow(new Date(String(value)), {
                addSuffix: true,
              }).replace("about ", "")
            }
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(value) => {
                  return (
                    <div className="flex gap-3 items-center">
                      <span>{format(new Date(String(value)), "P")}</span>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(String(value)), {
                          addSuffix: true,
                        }).replace("about ", "")}
                      </span>
                    </div>
                  );
                }}
                formatter={(value, name, item) => {
                  const numeric = Number(value) || 0;
                  const isTotal = name === "total";
                  const color = item?.color ?? item?.payload?.stroke;

                  if (isTotal) {
                    return (
                      <span className="flex items-center gap-2 font-mono w-full min-w-[275px]">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={color ? { backgroundColor: color } : {}}
                        />
                        <span>Total</span>
                        <span className="bg-muted h-px flex-1"></span>
                        <span className="ml-auto text-right">
                          {numeric.toLocaleString()} posts
                        </span>
                      </span>
                    );
                  }

                  const nameStr = String(name ?? "");
                  const label = nameStr.startsWith("r/")
                    ? nameStr
                    : `r/${nameStr}`;

                  return (
                    <span className="flex items-center gap-2 font-mono w-full min-w-[275px]">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={color ? { backgroundColor: color } : {}}
                      />
                      <span>{label}</span>
                      <span className="bg-muted h-px flex-1"></span>
                      <span className="ml-auto text-right">
                        {numeric.toLocaleString()} posts
                      </span>
                    </span>
                  );
                }}
              />
            }
          />
          {/* Total area (green) */}
          {!hiddenSeries.has("total") && (
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--color-total, hsl(142 70% 45%))"
              fill="var(--color-total, hsl(142 70% 45%))"
              fillOpacity={0.2}
              strokeWidth={2}
              dot={false}
              activeDot={false}
            />
          )}

          {/* One line per subreddit */}
          {data?.series &&
            (() => {
              const subreddits = new Set<string>();
              for (const point of data.series) {
                Object.keys(point.subreddits ?? {}).forEach((sub) =>
                  subreddits.add(sub)
                );
              }

              return Array.from(subreddits)
                .sort()
                .map((subreddit) =>
                  hiddenSeries.has(subreddit) ? null : (
                    <Area
                      key={subreddit}
                      type="monotone"
                      dataKey={subreddit}
                      stroke={`var(--color-${subreddit})`}
                      fill={`var(--color-${subreddit})`}
                      fillOpacity={0.15}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={false}
                    />
                  )
                );
            })()}
        </AreaChart>
      </ChartContainer>

      {/* Custom legend below the chart */}
      {data?.series &&
        data.series.length > 0 &&
        (() => {
          const subreddits = new Set<string>();
          for (const point of data.series) {
            Object.keys(point.subreddits ?? {}).forEach((sub) =>
              subreddits.add(sub)
            );
          }

          const palette = [
            "hsl(210 80% 60%)",
            "hsl(25 90% 55%)",
            "hsl(280 70% 60%)",
            "hsl(190 75% 55%)",
            "hsl(340 75% 60%)",
          ];

          const items = [
            {
              key: "total",
              label: "Total (all subreddits)",
              color: "hsl(142 70% 45%)",
            },
            ...Array.from(subreddits)
              .sort()
              .map((subreddit, index) => ({
                key: subreddit,
                label: `r/${subreddit}`,
                color: palette[index % palette.length],
              })),
          ];

          return (
            <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted-foreground px-10">
              {items.map((item) => {
                const isHidden = hiddenSeries.has(item.key);
                return (
                  <Badge
                    key={item.key}
                    onClick={() => {
                      setHiddenSeries((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.key)) {
                          next.delete(item.key);
                        } else {
                          next.add(item.key);
                        }
                        return next;
                      });
                    }}
                    className={
                      isHidden
                        ? "opacity-40 grayscale cursor-pointer"
                        : "hover:bg-muted cursor-pointer"
                    }
                    variant={"outline"}
                  >
                    <span
                      className="inline-block h-2 w-4 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.label}</span>
                  </Badge>
                );
              })}
            </div>
          );
        })()}
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

  const { data: unscoredData } = api.reddit.campaigns.countUnscored.useQuery({
    campaignId,
  });
  const unscoredCount = unscoredData?.count ?? 0;

  const scoreUnscoredPosts =
    api.reddit.campaigns.adminQueueScorePosts.useMutation({
      onSuccess: () => {
        toast.success("Evaluation queued");
        utils.reddit.campaigns.countUnscored.invalidate({ campaignId });
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
