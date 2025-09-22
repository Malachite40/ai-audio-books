import { WelcomeEmail } from "@workspace/transactional";
import z from "zod";
import { resend } from "../lib/resend";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const emailsRouter = createTRPCRouter({
  join: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        group: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const emailLower = input.email.toLowerCase();

      await ctx.db.emails.upsert({
        where: { email_group: { email: emailLower, group: input.group } },
        update: { group: input.group.toLowerCase() },
        create: { email: emailLower, group: input.group.toLowerCase() },
      });

      await resend.emails.send({
        from: "Instant Audio Online <support@instantaudio.online>",
        to: [input.email],
        subject: "Welcome to Instant Audio Online!",
        react: WelcomeEmail({ username: input.email.split("@")[0] }),
      });

      return {};
    }),
  check: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingEmail = await ctx.db.emails.findFirst({
        where: {
          email: {
            mode: "insensitive",
            equals: input.email.toLowerCase(),
          },
        },
      });
      if (existingEmail) return { subscribed: true };

      return {
        subscribed: false,
      };
    }),
});
