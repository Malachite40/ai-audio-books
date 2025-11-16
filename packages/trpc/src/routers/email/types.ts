import z from "zod";

export const sendRedditDailyDigestForAdmin = z.object({
  campaignId: z.string().uuid(),
  minScore: z.number().min(1).max(100),
  hoursBack: z.number().min(1).max(72),
});

export type SendRedditDailyDigestForAdminInput = z.infer<
  typeof sendRedditDailyDigestForAdmin
>;
