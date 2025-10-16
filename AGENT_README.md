# AI Agent Guide: Architecture, Workflows, and Tips

This document gives AI agents a concise, actionable mental model of how tRPC, the database, and the frontend fit together in this monorepo, plus how to run, extend, and debug it locally.

## High-Level Overview

- Monorepo managed by Turbo and Bun.
- Next.js app (`apps/web`) renders the UI and calls the tRPC API.
- Shared tRPC package (`packages/trpc`) defines the API router, context, middlewares, and integrations (auth, Stripe, Cloudflare R2, emails).
- Prisma-based database package (`packages/database`) provides the Prisma client and schema.
- Queue worker (`apps/queue`) processes background jobs via Celery (RabbitMQ + Redis) and calls tRPC procedures with a queue context.
- Transactional emails (`packages/transactional`) provide React Email templates used by tRPC (welcome email).

Data flow:

- Frontend calls tRPC (server or client). tRPC uses Prisma to read/write DB and can enqueue tasks via Celery. Workers pick up tasks and may stream media to R2, then update DB. Frontend observes status via tRPC queries.

## Repository Map

- apps/web: Next.js 15 (App Router) site and API routes
  - tRPC server integration: `apps/web/app/api/trpc/[trpc]/route.ts`
  - RSC helper: `apps/web/trpc/server.ts`
  - Client provider: `apps/web/trpc/react.tsx`
- apps/queue: Celery worker wiring to run background tasks
  - Worker entry: `apps/queue/index.ts`
  - tRPC caller for worker: `apps/queue/src/trpc.ts`
- packages/trpc: Shared API package
  - Context and auth bootstrap: `packages/trpc/src/context.ts`
  - Middlewares and helpers: `packages/trpc/src/trpc.ts`
  - App router: `packages/trpc/src/router.ts` and `packages/trpc/src/routers/*`
  - Env validation: `packages/trpc/src/env.ts`
  - Stripe, Resend, S3 (R2) clients: `packages/trpc/src/lib/*`, `packages/trpc/src/s3.ts`
  - Queue client and task names: `packages/trpc/src/queue/*`
- packages/database: Prisma client wrapper and schema
  - Prisma schema: `packages/database/prisma/schema.prisma`
  - Client export: `packages/database/src/client.ts`
- packages/transactional: Email templates and styles
  - Welcome email: `packages/transactional/emails/welcome.tsx`

## tRPC Architecture

- Router: `packages/trpc/src/router.ts` composes feature routers: users, speakers, audio, workers, credits, stripe, subscriptions, support, kv, emails, debug.
- Context: `packages/trpc/src/context.ts`
  - `createNextTRPCContext({ headers })` resolves the current session via Better Auth, fetches/creates per-user `Credits` and `Subscriptions`, ensures a Stripe customer exists (creating one if missing), and can send a welcome email via Resend. It returns a `BaseContext` with `db` (Prisma), `user`, `session`, `credits`, `subscription`, and `stripeCustomerId`.
  - `createContext()` provides a bare context with just `db` (useful for server-to-server call sites).
  - `createQueueContext({ apiKey })` for worker calls.
- Middlewares: `packages/trpc/src/trpc.ts`
  - `publicProcedure` – no auth required.
  - `authenticatedProcedure` – requires valid session and ensures `credits`, `subscription`, and Stripe customer id are present.
  - `adminProcedure` – requires `user.role === 'admin'`.
  - `queueProcedure` – checks a shared API key for worker tasks.
- Example usage (Users router): `packages/trpc/src/routers/users.ts`
- Background workers (tRPC side): `packages/trpc/src/routers/workers.ts` (long, handles audio chunking/concat, uploads to R2, etc.) and `packages/trpc/src/routers/workers/ai.ts`.

### How Frontend Calls tRPC

- React Server Components (RSC): `apps/web/trpc/server.ts`
  - Wraps `createNextTRPCContext` and exposes `api` and `HydrateClient` via `createHydrationHelpers`.
  - Use this in server components for efficient data fetching and hydration.
- Client Components: `apps/web/trpc/react.tsx`
  - Creates `api = createTRPCReact<AppRouter>()` with `httpBatchStreamLink` to `"/api/trpc"` and `SuperJSON` transformer.
  - Wrap pages with `TRPCReactProvider` and use `api.<router>.<procedure>.useQuery()` / `.useMutation()`.
- tRPC HTTP adapter: `apps/web/app/api/trpc/[trpc]/route.ts` uses `fetchRequestHandler` with `appRouter` and `createNextTRPCContext`.

## Emails (Transactional)

- Templates live in `packages/transactional/emails` and are built with `@react-email/components`, using shared layout and tokens:
  - Components: `packages/transactional/src/components.tsx`
  - Styles: `packages/transactional/src/styles.ts`
  - Example: `packages/transactional/emails/welcome.tsx`
- Send with Resend by passing a React tree:
  - Context path: `packages/trpc/src/context.ts:82` sends `WelcomeEmail` after Stripe customer creation.
  - Router path: `packages/trpc/src/routers/emails.ts:23` sends `WelcomeEmail` on join.
- Add a template: create `packages/transactional/emails/<name>.tsx`, export from `packages/transactional/src/index.ts`, then call `resend.emails.send({ from, to, subject, react: <YourTemplate /> })` in a tRPC proc.
- Asset base URL: templates read `process.env.FRONTEND_URL` in `EmailLayout` to build absolute image links.

## Database Layer

- Prisma schema: `packages/database/prisma/schema.prisma` (PostgreSQL). Notable models:
  - Auth: `User`, `Session`, `Account`, `Verification` (Better Auth tables)
  - Product: `Speaker`, `AudioFile`, `AudioChunk`, `AudioFileSettings`, `UserAudioFile`
  - Billing: `Subscriptions` (FREE/BASIC/PRO), `Credits`
  - Utility: `KeyValueStore`, `SupportSubmission`, `Emails`
- Client export: `@workspace/database` exports a singleton Prisma client (`prisma`) and types. Import via `import { prisma } from "@workspace/database"` or use `ctx.db` inside tRPC.
- Migrations and codegen (run from repo root or `packages/database`):
  - `bun -w packages/database run generate` – generate Prisma client
  - `bun -w packages/database run db:migrate:dev` – create/apply migrations
  - `bun -w packages/database run studio` – open Prisma Studio

## Background Jobs (Celery Worker)

- Worker entry: `apps/queue/index.ts` sets up a Celery worker using `createWorker(BROKER, REDIS_URL)` and registers task names from `TASK_NAMES`.
- Worker executes tRPC procedures by building a server-side caller with `createQueueContext({ apiKey: "1113" })` and `createCaller(ctx)`.
- Queue client (for enqueuing): `packages/trpc/src/queue/client.ts` uses `createClient(BROKER, REDIS_URL)` to push tasks.
- Task names: `packages/trpc/src/queue/index.ts`
- Typical flow:
  1. Web enqueues a task, e.g. `client.createTask(TASK_NAMES.concatAudioFile).applyAsync([{ id }])`.
  2. Celery worker picks it up and calls the corresponding tRPC `queueProcedure` mutation.
  3. Worker streams input chunks, uses ffmpeg to transcode/concat, uploads output to Cloudflare R2 via `s3Client`, and updates DB rows.

## Storage and Media

- Cloudflare R2 via AWS SDK S3 client: `packages/trpc/src/s3.ts`.
- Presigned uploads for images: `packages/trpc/src/routers/images.ts`.
- ffmpeg: `ffmpeg-static` is used in workers to process audio.

## Auth

- Better Auth setup: `packages/trpc/src/lib/auth.ts` with Prisma adapter and plugins (`nextCookies`, `admin`, `expo`).
- Next.js route: `apps/web/app/api/auth/[...all]/route.ts`.
- tRPC context uses `auth.api.getSession({ headers })`.
- On first authenticated context without a `stripeCustomerId`, a Stripe customer is created and a welcome email is sent.

## Stripe Webhooks

- Entry route: `apps/web/app/api/webhooks/stripe/route.ts`
  - Reads raw body via `await req.text()` and verifies the `stripe-signature` header using `stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)`.
  - Delegates to `handleStripeEvent(event)` and returns JSON 200 on success.
- Dispatcher: `apps/web/app/api/webhooks/stripe/handler.ts`
  - Switches on `event.type` and calls a per-event handler.
  - Example cases: `payment_intent.succeeded`, `invoice.paid`, `customer.subscription.deleted`, `checkout.session.completed`.
- Per-event handlers: one file per Stripe event in the same folder; file name mirrors the Stripe event type string.
  - Examples:
    - `apps/web/app/api/webhooks/stripe/checkout.session.completed.ts` → `handleCheckoutSessionCompleted(event: Stripe.CheckoutSessionCompletedEvent)`; expands line items, credits users based on `env.ONE_M_CREDIT_PRICE`.
    - `apps/web/app/api/webhooks/stripe/invoice.paid.ts` → `handleInvoicePaid(event: Stripe.InvoicePaidEvent)`; maps price ids to `SubscriptionPlans` via `env.STRIPE_BASIC_PLAN` and `env.STRIPE_PRO_PLAN`, upserts `subscriptions` and `credits`.
    - `apps/web/app/api/webhooks/stripe/customer.subscription.deleted.ts` → `handleCustomerSubscriptionDelete(event: Stripe.CustomerSubscriptionDeletedEvent)`; sets plan to `FREE` and clears `stripeSubscriptionId`.
    - `apps/web/app/api/webhooks/stripe/payment_intent.succeeded.ts` → placeholder handler typed as `Stripe.PaymentIntentSucceededEvent`.
- Naming convention:
  - Use the exact Stripe event type string as the filename, preserving punctuation: e.g., `checkout.session.completed.ts`, `invoice.paid.ts`, `payment_intent.succeeded.ts`, `customer.subscription.deleted.ts`.
  - Export a function named `handle<EventCamelCase>` receiving the specific typed `Stripe.<EventName>Event`.
  - Add a `case "<event.type>"` in `handler.ts` that calls your new function.

## Running Locally

1. Prereqs: Node 20+, Bun, Docker.
2. Start infra: `docker compose up -d` (Postgres, RabbitMQ, Redis).
3. Generate Prisma client: `bun -w packages/database run generate`.
4. Migrate DB: `bun -w packages/database run db:migrate:dev`.
5. Dev servers: from repo root run `bun run dev` (Turbo will run `apps/web` and `apps/queue` dev scripts).
   - Or run individually:
     - Web: `cd apps/web && bun run dev`
     - Queue: `cd apps/queue && bun run dev`
6. Optional: Stripe webhook forwarding: `bun -w apps/web run stripe`.

## Extending the API (tRPC)

Add new procedures under `packages/trpc/src/routers/<feature>.ts`:

```ts
import z from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  authenticatedProcedure,
} from "../trpc";

export const exampleRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }).optional())
    .query(({ input }) => ({ message: `Hello ${input?.name ?? "world"}` })),

  doThing: authenticatedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.someModel.update({
        where: { id: input.id },
        data: {
          /* ... */
        },
      });
      return { ok: true };
    }),
});
```

Wire it up in `packages/trpc/src/router.ts` and export types as needed.

Frontend usage:

- RSC: `const data = await api.example.hello({ name: "A" });`
- Client: `const { data } = api.example.hello.useQuery({ name: "A" });`

## Forms (Zod + React Hook Form)

- Define a Zod schema and infer types; integrate with `react-hook-form` via `zodResolver`.
  - Example schema: `apps/web/components/feedback-form.tsx:17`
  - Form setup: `useForm({ resolver: zodResolver(Schema), defaultValues, mode: 'onChange' })`
  - Submit with tRPC mutation: `api.support.submit.useMutation()` and `form.handleSubmit(onSubmit)`.
  - Render with shadcn form primitives: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`.

Snippet:

```tsx
const Schema = z.object({
  email: z.string().email().optional(),
  message: z.string().min(1),
});
type Values = z.infer<typeof Schema>;
const form = useForm<Values>({
  resolver: zodResolver(Schema),
  mode: "onChange",
});
const save = api.support.submit.useMutation();
<Form {...form}>
  <form onSubmit={form.handleSubmit((v) => save.mutate(v))}> ... </form>
</Form>;
```

## Responsive Modal (Dialog/Drawer)

Use the responsive modal to render a desktop Dialog and a mobile Drawer with a single API. The component lives at `apps/web/components/resonpsive-modal.tsx`.

- Props: `open: boolean`, `onOpenChange: (v: boolean) => void`, `title: string`, `description?: string`, `children?: React.ReactNode`
- Behavior: switches between `Dialog` (≥ `MEDIA_QUERY.MD`) and `Drawer` (< `MEDIA_QUERY.MD`).
- Import locally from sibling components as shown below.

Example:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { ResponsiveModal } from "./resonpsive-modal";

export function ExampleModalTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Example Title"
        description="Optional description goes here."
      >
        <div className="space-y-3 text-sm">
          <p>Any React content as children.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button className="flex-1" onClick={() => {/* do something */}}>
              Confirm
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </>
  );
}
```

## Pagination Pattern (Frontend + tRPC + DB)

- Server: use cursor pagination with `take = limit + 1` + optional `cursor`; if more than `limit`, pop and set `nextCursor`.
  - Audio router example: `packages/trpc/src/routers/audio.ts:82`
  - Favorites router example: `packages/trpc/src/routers/favoritesRouter.ts:77`
- Client: use `useInfiniteQuery` via tRPC React; pass `getNextPageParam: (last) => last.nextCursor`.
  - History: `apps/web/components/audio/audio-history.tsx:20`
  - Favorites: `apps/web/components/audio/audio-file-favorites.tsx:20`
- UX: merge pages `data.pages.flatMap(p => p.items)` (here `audioFiles`) and use an `IntersectionObserver` sentinel to prefetch the next page.

## Common Workflows

- Create audio: Use tRPC mutations under `audio`, `workers`, and `workers.ai` routers. The pipeline will enqueue tasks, create chunks, render, and concat to produce an MP3 in R2.
- Manage speakers: `speakers` router (CRUD, plus example audio generation).
- Billing: `stripe` and `subscriptions` routers; `credits` for one-off purchases.
- Admin: guarded by `adminProcedure` (see `apps/web/app/(admin)` UI).

## Troubleshooting

- Prisma client missing: run `bun -w packages/database run generate`.
- Env validation failing: set keys or use `SKIP_ENV_VALIDATION=1` while developing non-affected areas.
- Queue tasks not running: ensure `BROKER` and `REDIS_URL` are set in both web and queue envs, `docker compose up` is running, and `apps/queue` is started.
- R2 upload issues: validate R2 endpoint, bucket, and credentials; check that your bucket allows the operation.
- Auth/Stripe flows: if you don’t need them locally, avoid logging in; otherwise provide valid keys.

## Conventions and Tips for Agents

- Validate inputs with `zod` in every procedure.
- Use `ctx.db` (Prisma) for all DB access from tRPC.
- Keep routers cohesive and small; compose in `router.ts`.
- Use `publicProcedure` for read-only public access; use `authenticatedProcedure` for user-specific mutations/queries; `adminProcedure` for admin-only.
- For background work, enqueue via `packages/trpc/src/queue/client.ts` and implement the worker-side logic as `queueProcedure` mutations.
- Prefer server-side tRPC calls in RSC for SSR and hydration; use the React client only in client components.
- Follow existing style/structure; avoid unrelated refactors.

---

Quick anchors:

- App router: packages/trpc/src/router.ts
- Context: packages/trpc/src/context.ts
- Web RSC tRPC: apps/web/trpc/server.ts
- Web client tRPC: apps/web/trpc/react.tsx
- Prisma schema: packages/database/prisma/schema.prisma
- Worker wiring: apps/queue/index.ts
- Worker routers: packages/trpc/src/routers/workers.ts
- Env schema: packages/trpc/src/env.ts
- R2 client: packages/trpc/src/s3.ts
- Emails: packages/transactional/emails/welcome.tsx
