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
- apps/cron: Bun-powered cron scheduler for server-to-server tRPC calls
  - Entry: `apps/cron/index.ts`
  - tRPC caller for cron: `apps/cron/trpc.ts`
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

## Naming Conventions

- App Router pages (server): keep `page.tsx` as a server component that default-exports a small wrapper rendering a co-located client component when needed.
  - Client entry files end with `.client.tsx` and export a named component `XxxClientPage`.
  - The server page imports the named export and renders it.
  - Examples:
    - `apps/web/app/(admin)/admin/users/page.tsx` → imports `{ UsersClientPage }` from `./users.client`.
    - `apps/web/app/(admin)/admin/stats/page.tsx` → imports `{ StatsClientPage }` from `./stats.client`.
    - `apps/web/app/(admin)/admin/leads/page.tsx` → imports `{ LeadsClientPage }` from `./leads.client`.

- Route-local UI components: place under an `_components/` folder next to the route, use kebab-case filenames, and export named PascalCase components.
  - Example: `apps/web/app/(admin)/admin/_components/admin-users.tsx` exports `AdminUsersCard`.
  - Add `"use client"` at the top only when hooks/state or browser-only APIs are used.

- Webhooks: see the Stripe Webhooks section for event handler file naming that mirrors the Stripe event type (e.g., `checkout.session.completed.ts`).

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
- Enqueue helper: prefer `packages/trpc/src/queue/enqueue.ts` (`enqueueTask`) over direct `client.createTask(...).applyAsync(...)` to avoid Redis ready-listener buildup and to reuse cached Task instances.
- Task names: `packages/trpc/src/queue/index.ts`
- Typical flow:
  1. Web enqueues a task with `enqueueTask("concatAudioFile", { id })`.
  2. Celery worker picks it up and calls the corresponding tRPC `queueProcedure` mutation.
  3. Worker streams input chunks, uses ffmpeg to transcode/concat, uploads output to Cloudflare R2 via `s3Client`, and updates DB rows.

Enqueuing tasks (best practices)

- Use `enqueueTask(taskKey, payload)` from `packages/trpc/src/queue/enqueue.ts`:
  - Awaits a single Redis readiness gate to prevent EventEmitter warnings.
  - Reuses a cached `Task` instance per task name.
  - Normalizes calling convention to pass a single payload object.

Examples

Type-safe payloads

- Use the TypeScript `satisfies` operator with Zod inference to guarantee at compile time that the payload matches the target procedure’s input schema.

```ts
import z from "zod";
import { enqueueTask } from "@workspace/trpc/src/queue/enqueue";
import { TASK_NAMES } from "@workspace/trpc/src/queue";

// Define or import the exact Zod input schema used by the queue procedure
const CreateChunksInput = z.object({
  audioFileId: z.string().uuid(),
  chunkSize: z.number().min(1),
  includeTitle: z.boolean().optional(),
});

await enqueueTask(TASK_NAMES.createAudioFileChunks, {
  audioFileId,
  chunkSize: 500,
  includeTitle: true,
} satisfies z.infer<typeof CreateChunksInput>);
```

Do/Don’t

- Do pass a single object as the payload that matches the Zod schema of the target `queueProcedure`. Don’t pass arrays as the payload.
- Do batch with `Promise.all` when enqueuing many tasks; keep payloads small and idempotent.
- Do prefer `enqueueTask` to avoid piling up `ready` listeners on Redis; if you must use the low-level client, call `await client.isReady()` once and reuse a cached `Task` instance.
- Do keep task handlers idempotent by using unique constraints and `upsert` patterns where possible.

## Cron Scheduler (Bun + node-cron)

- Location: `apps/cron`
- Runtime: Bun. Scheduler: `node-cron` (default import `import cron from "node-cron"`).
- Purpose: trigger lightweight, scheduled tasks that make single-line tRPC calls using a queue context (`createQueueContext`) and defer heavy work to workers.

Files:

- `apps/cron/index.ts` – registers cron schedules. Example schedule: `"0,10,20,30,40,50 * * * *"`.
- `apps/cron/trpc.ts` – builds a server-to-server tRPC caller:

```ts
import { createCaller, createQueueContext } from "@workspace/trpc/server";
const ctx = await createQueueContext({ apiKey: "1113" });
export const api = createCaller(ctx);
```

Initial job:

- Calls `await api.debug.helloWorld()` on each tick. The `debug.helloWorld` procedure is a `queueProcedure` that logs "hello world" in the cron app’s console.

Best practices:

- Keep cron jobs to single-line tRPC calls; do not embed heavy logic in the cron process.
- Expose cron-callable procedures as `queueProcedure` so they’re server-to-server only.
- Make cron-triggered operations idempotent (safe to retry) and fast to return.
- Push long-running work to the queue workers (`apps/queue`) via existing tRPC endpoints.
- Log clearly and catch errors around each scheduled call to avoid crashing the scheduler.
- Prefer configuration via code; if env is needed, add `.env` under `apps/cron` and read via `process.env`.

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

## Global Singletons

Purpose

- Keep one instance of SDK/clients during dev hot reloads to avoid duplicate connections and memory leaks.

Pattern (attach to `global`)

- Cast `global` to a typed bag, create or reuse, then cache in non‑prod:
  - `const globalForX = global as unknown as { x: Type }`
  - `export const x = globalForX.x || new Type(/* ... */)`
  - `if (process.env.NODE_ENV !== "production") globalForX.x = x`

Examples

- Prisma client: packages/database/src/client.ts:3
- Stripe client: packages/trpc/src/lib/stripe/index.ts:5
- Resend client: packages/trpc/src/lib/resend/index.ts:5
- Celery queue client: packages/trpc/src/queue/client.ts:3
- Task cache via `globalThis`: packages/trpc/src/queue/enqueue.ts:11, packages/trpc/src/queue/enqueue.ts:21

Notes

- Prefer the reuse form (`globalForX.x || new Type()`) so hot reloads do not create multiple instances. Some modules (e.g., the Celery client) currently instantiate unconditionally; mirror the Prisma pattern if you need reuse.
- `declare global { var __name__: Type | undefined }` with `globalThis.__name__ ??= value` is also used for simple caches where a full SDK instance isn’t needed.

## Environment Variables

Sources

- Shared server env (tRPC and workers): `packages/trpc/src/env.ts`
- Next.js app env: `apps/web/env.ts`

How it works

- Uses `@t3-oss/env-nextjs` + Zod to validate at startup/build and provide typed access via an `env` export.
- Two schemas per file:
  - `server`: server-only keys (never exposed to the browser)
  - `client`: browser-exposed keys (must be prefixed with `NEXT_PUBLIC_`)
- `runtimeEnv`: explicit mapping from `process.env` to satisfy edge/client constraints and avoid destructuring `process.env`.
- `skipValidation`: set `SKIP_ENV_VALIDATION=1` to bypass checks (useful in Docker builds or partial local setups).
- `emptyStringAsUndefined: true`: empty strings are treated as missing and will fail validation.
- `packages/trpc/src/env.ts` calls `dotenv.config()` to load `.env` before validation for Node runtimes. Next.js (`apps/web/env.ts`) relies on Next’s env loading.

Key locations and usage

- tRPC server code imports `env` from `packages/trpc/src/env.ts` (e.g., `context.ts`, `s3.ts`, `lib/resend`, routers).
- Next.js code imports `env` from `apps/web/env.ts` and may access both server and client keys.

Adding a variable

- Define in the appropriate schema(s) and wire in `runtimeEnv`:

```ts
// packages/trpc/src/env.ts
server: { MY_SECRET: z.string() },
client: { NEXT_PUBLIC_FOO: z.string().url() },
runtimeEnv: {
  MY_SECRET: process.env.MY_SECRET,
  NEXT_PUBLIC_FOO: process.env.NEXT_PUBLIC_FOO,
}
```

Using a variable

- Server only: `import { env } from "../env"; env.MY_SECRET`
- Client safe: `env.NEXT_PUBLIC_FOO` (from `apps/web/env.ts`)

Where to set values

- Next.js app: `apps/web/.env`
- Queue worker: `apps/queue/.env`
- Cron: `apps/cron/.env`
- Shared server libs: rely on the process’s env; `.env` in `packages/trpc/` is supported by its `dotenv.config()` when that package is the entrypoint in Node.

## Running Locally

1. Prereqs: Node 20+, Bun, Docker.
2. Start infra: `docker compose up -d` (Postgres, RabbitMQ, Redis).
3. Generate Prisma client: `bun -w packages/database run generate`.
4. Migrate DB: `bun -w packages/database run db:migrate:dev`.
5. Dev servers: from repo root run `bun run dev` (Turbo will run app dev scripts).
   - Or run individually:
     - Web: `cd apps/web && bun run dev`
     - Queue: `cd apps/queue && bun run dev`
     - Cron: `cd apps/cron && bun run dev`
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
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                /* do something */
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </>
  );
}
```

## Pagination Patterns

Default recommendation (apps/web tables)

- Prefer numbered pagination (page/pageSize + total) using the shared `PaginationBar`.
- Use cursor/infinite pagination only for true feeds or infinite scroll UX.

Approach 1 — Numbered Pagination (preferred for tables)

- When to use
  - Admin/data tables, filterable lists, jump-to-page UX, showing “X–Y of Z”.
  - When you need a stable count and clear page boundaries.
- API shape
  - Input: `{ page, pageSize, ...filters }`
  - Output: `{ items, total }`
- DB query
  - `skip: (page - 1) * pageSize`, `take: pageSize`, `orderBy: <stable>` and mirror filters in a matching `count()`.
- Client usage
  - Keep `page` state; compute `totalPages = Math.ceil(total / pageSize)`; render `PaginationBar`.
  - Reset `page` to 1 when filters/search change; debounce search inputs.
- Pros
  - Simple UX, easy to link/share specific pages, trivial “X of Y” display.
  - Works naturally with server-rendered tables and admin views.
- Tradeoffs
  - Requires a `count()` which can be expensive on very large datasets.
  - Can show duplicates/omissions if ordering isn’t stable; always set a deterministic `orderBy`.

Approach 2 — Cursor (Infinite) Pagination

- When to use
  - Infinite scroll feeds, activity timelines, very large lists where `count()` is costly or unnecessary.
- API shape
  - Input: `{ limit, cursor?, ...filters }`
  - Output: `{ items, nextCursor }`
- DB query
  - `take: limit + 1`, `orderBy: <stable>`, optional `cursor`; if `items.length > limit`, pop the extra and set `nextCursor`.
- Client usage
  - `useInfiniteQuery` with `getNextPageParam: (last) => last.nextCursor` and merge pages (`data.pages.flatMap(p => p.items)`).
- Pros
  - Efficient for endless lists; avoids expensive counts; resilient to concurrent inserts.
- Tradeoffs
  - No built-in notion of total pages; harder to jump to arbitrary positions.

References

- Numbered pattern
  - Frontend: `apps/web/app/(admin)/admin/_components/admin-users.tsx`, `apps/web/app/(admin)/admin/leads/page.tsx`, `apps/web/components/pagination-bar.tsx`
  - tRPC: `packages/trpc/src/routers/users.ts` (`adminList`), `packages/trpc/src/routers/reddit.ts` (`listPosts`)
- Cursor pattern
  - Server examples: `packages/trpc/src/routers/audio.ts`, `packages/trpc/src/routers/favoritesRouter.ts`
  - Client examples: `apps/web/components/audio/audio-history.tsx`, `apps/web/components/audio/audio-file-favorites.tsx`

Implementation checklist

- Always use a deterministic `orderBy`.
- Mirror filters between the `findMany` and `count()`.
- Debounce free-text search; reset `page` when any filter changes.
- Disable Prev/Next at bounds; show “Showing X–Y of Z” when using numbered pagination.

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

## URL Query State (nuqs `useQueryState`)

- Purpose
  - Keep UI state in the URL search params so it’s shareable, deep-linkable, and persists on refresh/back/forward.
- Library
  - `useQueryState` from `nuqs`. Parsers like `parseAsString` define how a param is read/written.
- Client‑only
  - Use inside client components (file must include `"use client"`).

Basic example (mode switcher)

```tsx
import { parseAsString, useQueryState } from "nuqs";

// Binds the `mode` query param to React state.
// Example URL: /new?mode=copy
const [mode, setMode] = useQueryState(
  "mode",
  parseAsString.withDefault("").withOptions({})
);

// Set a mode (updates URL):
setMode("copy"); // => ?mode=copy

// Clear to default (removes UI selection):
setMode(""); // => ? (default from withDefault)
```

In practice, this drives conditional UIs, e.g. swapping forms based on `mode` and providing a back action that clears it. See `apps/web/app/(app)/audio-file/new/new.audio.client.tsx` for a working usage.

Notes

- `parseAsString.withDefault("")` supplies a value when the param is missing.
- Call `setMode(value)` to push a new value into the URL; use the default to “reset”.
- Keep param keys stable; avoid frequent renames since URLs may be shared/bookmarked.

---

Quick anchors:

- App router: packages/trpc/src/router.ts
- Context: packages/trpc/src/context.ts
- Web RSC tRPC: apps/web/trpc/server.ts
- Web client tRPC: apps/web/trpc/react.tsx
- Prisma schema: packages/database/prisma/schema.prisma
- Worker wiring: apps/queue/index.ts
- Worker routers: packages/trpc/src/routers/workers.ts
- Cron entry: apps/cron/index.ts
- Cron tRPC caller: apps/cron/trpc.ts
- Env schema: packages/trpc/src/env.ts
- R2 client: packages/trpc/src/s3.ts
- Emails: packages/transactional/emails/welcome.tsx
