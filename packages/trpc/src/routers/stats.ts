import z from "zod";
import { adminProcedure, createTRPCRouter } from "../trpc";

function daysAgoUTC(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

function formatDateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const statsRouter = createTRPCRouter({
  overview: adminProcedure.query(async ({ ctx }) => {
    const [totalUsers, totalAudioFiles, processedAgg, processedFiles, subs] =
      await Promise.all([
        ctx.db.user.count(),
        ctx.db.audioFile.count({ where: { deletedAt: null } }),
        ctx.db.audioFile.aggregate({
          _sum: { durationMs: true },
          where: { status: "PROCESSED", deletedAt: null },
        }),
        ctx.db.audioFile.count({
          where: { status: "PROCESSED", deletedAt: null },
        }),
        ctx.db.subscriptions.groupBy({ by: ["plan"], _count: { plan: true } }),
      ]);

    const paidByPlan = subs.reduce<Record<string, number>>((acc, s) => {
      acc[s.plan] = s._count?.plan ?? s._count?.plan ?? 0;
      return acc;
    }, {});

    const paidBasic = paidByPlan["BASIC"] ?? 0;
    const paidPro = paidByPlan["PRO"] ?? 0;
    const paidTotal = paidBasic + paidPro;

    return {
      users: {
        total: totalUsers,
        paidTotal,
        paidByPlan: { BASIC: paidBasic, PRO: paidPro },
      },
      audio: {
        totalFiles: totalAudioFiles,
        processedFiles,
        processedDurationMs: processedAgg._sum.durationMs ?? 0,
      },
    };
  }),

  usersByDay: adminProcedure
    .input(
      z.object({ days: z.number().min(1).max(365).default(30) }).optional()
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const start = daysAgoUTC(days);
      const users = await ctx.db.user.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const buckets = new Map<string, number>();
      // pre-fill with zeros
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        buckets.set(formatDateUTC(d), 0);
      }

      for (const u of users) {
        const key = formatDateUTC(new Date(u.createdAt));
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      return Array.from(buckets.entries()).map(([date, count]) => ({
        date,
        count,
      }));
    }),

  audioByDay: adminProcedure
    .input(
      z.object({ days: z.number().min(1).max(365).default(30) }).optional()
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const start = daysAgoUTC(days);
      const files = await ctx.db.audioFile.findMany({
        where: { createdAt: { gte: start }, deletedAt: null },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const buckets = new Map<string, number>();
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        buckets.set(formatDateUTC(d), 0);
      }

      for (const f of files) {
        const key = formatDateUTC(new Date(f.createdAt));
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      return Array.from(buckets.entries()).map(([date, count]) => ({
        date,
        count,
      }));
    }),

  processingBreakdown: adminProcedure.query(async ({ ctx }) => {
    const [files, chunks] = await Promise.all([
      ctx.db.audioFile.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { status: true },
      }),
      ctx.db.audioChunk.groupBy({ by: ["status"], _count: { status: true } }),
    ]);

    const audioFilesByStatus = files.map((f) => ({
      status: f.status,
      count: (f as any)._count?.status ?? f._count?.status ?? 0,
    }));
    const audioChunksByStatus = chunks.map((c) => ({
      status: c.status,
      count: (c as any)._count?.status ?? c._count?.status ?? 0,
    }));

    return { audioFilesByStatus, audioChunksByStatus };
  }),
});
