// TRPC router for support submissions
import { z } from "zod";
import { adminProcedure, createTRPCRouter, publicProcedure } from "../trpc";

export const supportRouter = createTRPCRouter({
  submit: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        description: z.string().min(1, "Description is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db.supportSubmission.create({
        data: {
          name: input.name,
          description: input.description,
          userId: ctx.user?.id ?? null,
          email: ctx.user?.email?.toLowerCase() ?? null,
        },
      });
      return { success: true };
    }),

  fetchAll: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const { page, pageSize } = input;
      const [submissions, total] = await Promise.all([
        ctx.db.supportSubmission.findMany({
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.db.supportSubmission.count(),
      ]);
      return { submissions, total };
    }),

  // Admin: list support submissions for a specific user
  adminListByUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      const where: any = {
        OR: [
          { userId: input.userId },
          ...(user?.email ? [{ email: { equals: user.email, mode: "insensitive" as const } }] : []),
        ],
      };
      const [items, total] = await Promise.all([
        ctx.db.supportSubmission.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.supportSubmission.count({ where }),
      ]);
      return {
        items,
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // Admin: mark a support submission as read (sets readAt)
  adminMarkRead: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.supportSubmission.update({
        where: { id: input.id },
        data: { readAt: new Date() },
      });
      return { success: true };
    }),

  // Admin: mark a support submission as unread (clears readAt)
  adminMarkUnread: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.supportSubmission.update({
        where: { id: input.id },
        data: { readAt: null },
      });
      return { success: true };
    }),

  // Admin: total unread submissions
  adminUnreadCount: adminProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.supportSubmission.count({
      where: { readAt: null },
    });
    return count;
  }),

  // Admin: mark all unread submissions as read
  adminMarkAllRead: adminProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.supportSubmission.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true, count: result.count };
  }),
});
