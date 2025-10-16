import type { Prisma } from "@workspace/database";
import z from "zod";
import { adminProcedure, createTRPCRouter, publicProcedure } from "../trpc";

export const usersRouter = createTRPCRouter({
  helloWorld: publicProcedure
    .input(z.object({ text: z.string().nullish() }).nullish())
    .query(({ input }) => {
      return {
        greeting: `Hello ${input?.text ?? "world!"}`,
      };
    }),
  fetchAll: publicProcedure
    .input(z.object({ text: z.string().nullish() }).nullish())
    .query(async ({ input, ctx }) => {
      const users = await ctx.db.user.findMany({});
      return {
        users,
      };
    }),
  self: publicProcedure.query(async ({ input, ctx }) => {
    return { user: ctx.user, session: ctx.session };
  }),

  // Admin: list users with pagination and optional filters
  adminList: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        q: z.string().optional(),
        role: z.enum(["admin", "user"]).optional(),
        banned: z.boolean().optional(),
        plan: z.enum(["FREE", "BASIC", "PRO"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.UserWhereInput = {};
      if (input.q && input.q.trim() !== "") {
        const q = input.q.trim();
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { id: { equals: q } },
        ];
      }
      if (input.role) where.role = input.role;
      if (typeof input.banned === "boolean") where.banned = input.banned;

      // Filter by subscription plan via the optional 1:1 relation
      // For 1:1 relations, Prisma requires an `is` wrapper
      const planFilter: Prisma.UserWhereInput | undefined = input.plan
        ? { Subscription: { is: { plan: input.plan } } }
        : undefined;

      const [users, total] = await Promise.all([
        ctx.db.user.findMany({
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          where: { ...where, ...(planFilter ? planFilter : {}) },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            banned: true,
            createdAt: true,
            Credits: { select: { amount: true } },
            Subscription: { select: { plan: true } },
          },
        }),
        ctx.db.user.count({
          where: { ...where, ...(planFilter ? planFilter : {}) },
        }),
      ]);

      return { users, total };
    }),

  // Admin: get user by id with summary
  adminGetById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          banned: true,
          banReason: true,
          banExpires: true,
          createdAt: true,
          updatedAt: true,
          Credits: { select: { amount: true } },
          Subscription: { select: { plan: true } },
        },
      });
      if (!user) return { user: null, stats: null };

      const [audioCount] = await Promise.all([
        ctx.db.audioFile.count({
          where: { ownerId: input.id, deletedAt: null },
        }),
      ]);

      return { user, stats: { audioCount } };
    }),

  // Admin: set a user's role ("user" | "admin")
  adminSetRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.update({
        where: { id: input.userId },
        data: { role: input.role },
        select: { id: true, role: true },
      });
      return { user };
    }),

  // Admin: set a user's banned state
  adminSetBanned: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        banned: z.boolean(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: any = { banned: input.banned };
      if (input.banned) {
        data.banReason = input.reason ?? "Manually banned";
        data.banExpires = null;
      } else {
        data.banReason = null;
        data.banExpires = null;
      }
      const user = await ctx.db.user.update({
        where: { id: input.userId },
        data,
        select: { id: true, banned: true, banReason: true },
      });
      return { user };
    }),

  // Admin: adjust a user's credits with audit trail
  adminAdjustCredits: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        // signed delta in tokens; positive adds, negative subtracts
        delta: z
          .number()
          .int()
          .min(-1_000_000_000)
          .max(1_000_000_000),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.userId } });
      if (!user) {
        throw new Error("User not found");
      }

      const MAX_BALANCE = 100_000_000; // 100 million tokens cap

      const result = await ctx.db.$transaction(async (tx) => {
        const current = await tx.credits.findUnique({
          where: { userId: input.userId },
          select: { amount: true },
        });
        const before = current?.amount ?? 0;
        const unclampedNext = before + input.delta;
        const after = Math.max(0, Math.min(MAX_BALANCE, unclampedNext));
        const appliedDelta = after - before; // actual applied change

        // Only write a transaction row if something changes
        if (appliedDelta !== 0) {
          await tx.creditTransaction.create({
            data: {
              userId: input.userId,
              amount: appliedDelta,
              reason: "admin_adjust",
              description: input.description ?? "",
            },
          });

          await tx.credits.upsert({
            where: { userId: input.userId },
            create: { userId: input.userId, amount: after },
            update: { amount: after },
          });
        }

        return { before, after, appliedDelta };
      });

      return result;
    }),
});
