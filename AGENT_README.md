# AI Agent Guide: Architecture, Workflows, and Tips

This guide gives AI agents a concise, actionable mental model of how tRPC, the database, the frontend, and background workers fit together in this monorepo, plus how to run, extend, and debug it locally.

---

## Table of Contents

1. [High-Level Architecture & Data Flow](#high-level-architecture--data-flow)
2. [Repository Map](#repository-map)
3. [tRPC & API Layer](#trpc--api-layer)
   - [tRPC Architecture](#trpc-architecture)
   - [How the Frontend Calls tRPC](#how-the-frontend-calls-trpc)
   - [Extending the API](#extending-the-api-trpc)
4. [Background Processing](#background-processing)
   - [Celery Worker & Queue](#background-jobs-celery-worker)
   - [Enqueuing Tasks](#enqueuing-tasks-best-practices)
   - [Cron Scheduler](#cron-scheduler-bun--node-cron)
5. [Database Layer](#database-layer)
6. [Emails (Transactional)](#emails-transactional)
7. [Storage & Media](#storage-and-media)
8. [Auth](#auth)
9. [Stripe Webhooks](#stripe-webhooks)
10. [Global Singletons](#global-singletons)
11. [Environment Variables](#environment-variables)
12. [UI & UX Patterns](#ui--ux-patterns)
    - [Forms (Zod + React Hook Form)](#forms-zod--react-hook-form)
    - [Responsive Modal](#responsive-modal-dialogdrawer)
    - [Icon-Only Buttons](#icon-only-buttons-tooltips)
    - [Pagination Patterns](#pagination-patterns)
    - [URL Query State (nuqs)](#url-query-state-nuqs-usequerystate)
13. [Common Workflows](#common-workflows)
14. [Running Locally](#running-locally)
15. [Troubleshooting](#troubleshooting)
16. [Conventions and Tips for Agents](#conventions-and-tips-for-agents)
17. [Quick Anchors](#quick-anchors)

---

## High-Level Architecture & Data Flow

**Stack / Structure**

- Monorepo managed by **Turbo** and **Bun**.
- **Next.js app** (`apps/web`) renders the UI and exposes the tRPC API.
- **Shared tRPC package** (`packages/trpc`) defines:
  - API router
  - Context
  - Middlewares
  - Integrations (auth, Stripe, Cloudflare R2, emails)
- **Prisma-based database** package (`packages/database`) provides Prisma client and schema.
- **Queue worker** (`apps/queue`) processes background jobs via Celery (RabbitMQ + Redis) using a queue tRPC context.
- **Cron** app (`apps/cron`) runs scheduled tRPC calls.
- **Transactional emails** (`packages/transactional`) provide React Email templates (e.g., welcome email) used by tRPC.

**Data flow**

1. Frontend calls tRPC (from server components or client components).
2. tRPC uses Prisma to read/write the DB and may enqueue tasks via Celery.
3. Workers pick up tasks, process audio/media (e.g., with ffmpeg), stream to R2, then update DB.
4. Frontend observes status via tRPC queries (polling or subscriptions depending on usage).

---

## Repository Map

- **`apps/web`** – Next.js 15 (App Router) site and API routes

  - tRPC server integration: `apps/web/app/api/trpc/[trpc]/route.ts`
  - RSC helper: `apps/web/trpc/server.ts`
  - Client provider: `apps/web/trpc/react.tsx`

- **`apps/queue`** – Celery worker wiring to run background tasks

  - Worker entry: `apps/queue/index.ts`
  - tRPC caller for worker: `apps/queue/src/trpc.ts`

- **`apps/cron`** – Bun-powered cron scheduler for server-to-server tRPC calls

  - Entry: `apps/cron/index.ts`
  - tRPC caller for cron: `apps/cron/trpc.ts`

- **`packages/trpc`** – Shared API package

  - Context & auth bootstrap: `packages/trpc/src/context.ts`
  - Middlewares & helpers: `packages/trpc/src/trpc.ts`
  - App router: `packages/trpc/src/router.ts` and `packages/trpc/src/routers/*`
  - Env validation: `packages/trpc/src/env.ts`
  - Stripe, Resend, S3 (R2) clients: `packages/trpc/src/lib/*`, `packages/trpc/src/s3.ts`
  - Queue client and task names: `packages/trpc/src/queue/*`

- **`packages/database`** – Prisma client wrapper and schema

  - Prisma schema: `packages/database/prisma/schema.prisma`
  - Client export: `packages/database/src/client.ts`

- **`packages/transactional`** – Email templates and styles
  - Welcome email: `packages/transactional/emails/welcome.tsx`

---

## tRPC & API Layer

### tRPC Architecture

- **Router**

  - `packages/trpc/src/router.ts` composes feature routers:
    - `users`, `speakers`, `audio`, `workers`, `credits`, `stripe`, `subscriptions`, `support`, `kv`, `emails`, `debug`, etc.

- **Context: `packages/trpc/src/context.ts`**

  - `createNextTRPCContext({ headers })`
    - Resolves current session via **Better Auth**.
    - Fetches/creates per-user `Credits` and `Subscriptions`.
    - Ensures a Stripe customer exists (creating one if missing).
    - Can send a welcome email via Resend on first Stripe customer creation.
    - Returns a `BaseContext` with:
      - `db` (Prisma client)
      - `user`
      - `session`
      - `credits`
      - `subscription`
      - `stripeCustomerId`
  - `createContext()`
    - Bare context with just `db`; used for server-to-server call sites when auth/user isn’t needed.
  - `createQueueContext({ apiKey })`
    - Context for worker/cron calls that authenticate via a shared API key.

- **Middlewares: `packages/trpc/src/trpc.ts`**

  - `publicProcedure`
    - No auth required.
  - `authenticatedProcedure`
    - Requires valid session.
    - Ensures `credits`, `subscription`, and `stripeCustomerId` are present.
  - `adminProcedure`
    - Requires `user.role === "admin"`.
  - `queueProcedure`
    - Checks a shared API key for worker/cron tasks (server-to-server only).

- **Examples**
  - Users router: `packages/trpc/src/routers/users.ts`
  - Worker-related routers:
    - `packages/trpc/src/routers/workers.ts` (audio chunking/concat, uploads to R2, etc.)
    - `packages/trpc/src/routers/workers/ai.ts`

### How the Frontend Calls tRPC

- **React Server Components (RSC): `apps/web/trpc/server.ts`**

  - Wraps `createNextTRPCContext`.
  - Exposes `api` and `HydrateClient` via `createHydrationHelpers`.
  - Use in server components for efficient data fetching and hydration.

- **Client Components: `apps/web/trpc/react.tsx`**

  - Creates `api = createTRPCReact<AppRouter>()`.
  - Uses `httpBatchStreamLink` to `"/api/trpc"` and `SuperJSON` transformer.
  - Wrap app/pages with `TRPCReactProvider`.
  - Usage:
    - Queries: `api.<router>.<procedure>.useQuery()`
    - Mutations: `api.<router>.<procedure>.useMutation()`

- **HTTP adapter (Next.js API route)**
  - `apps/web/app/api/trpc/[trpc]/route.ts`
  - Uses `fetchRequestHandler` with `appRouter` and `createNextTRPCContext`.

### Naming Conventions

- **App Router pages (server)**

  - Keep `page.tsx` as a server component that default-exports a small wrapper rendering a co-located client component when needed.
  - Client entry files:
    - End with `.client.tsx`
    - Export a named component `XxxClientPage`
  - Server page imports the named export and renders it.

  **Examples**

  - `apps/web/app/(admin)/admin/users/page.tsx`  
    → imports `{ UsersClientPage }` from `./users.client`.
  - `apps/web/app/(admin)/admin/stats/page.tsx`  
    → imports `{ StatsClientPage }` from `./stats.client`.
  - `apps/web/app/(admin)/admin/leads/page.tsx`  
    → imports `{ LeadsClientPage }` from `./leads.client`.

- **Route-local UI components**

  - Place under an `_components/` folder next to the route.
  - Use **kebab-case** filenames.
  - Export **PascalCase** components.

  **Example**

  - `apps/web/app/(admin)/admin/_components/admin-users.tsx`  
    → exports `AdminUsersCard`.
  - Add `"use client"` only when hooks/state or browser-only APIs are used.

- **Webhooks**
  - Stripe event handler file names mirror the event type (see [Stripe Webhooks](#stripe-webhooks)).

### Extending the API (tRPC)

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

Then wire it up in `packages/trpc/src/router.ts` and export types as needed.

**Frontend usage**

- **RSC**:  
  `const data = await api.example.hello({ name: "A" });`
- **Client**:  
  `const { data } = api.example.hello.useQuery({ name: "A" });`

---

## Background Processing

### Background Jobs (Celery Worker)

- Worker entry: `apps/queue/index.ts`
  - Sets up a Celery worker using `createWorker(BROKER, REDIS_URL)`.
  - Registers task names from `TASK_NAMES`.
- Worker executes tRPC procedures:
  - Builds a server-side caller with:
    - `createQueueContext({ apiKey: "1113" })`
    - `createCaller(ctx)`
- Task names and payloads: `packages/trpc/src/queue/index.ts`

**Typical flow**

1. Web enqueues a task with  
   `enqueueTask(TASK_NAMES.concatAudioFile, { id })`.
2. Celery worker picks it up and calls the corresponding tRPC `queueProcedure` mutation.
3. Worker:
   - Streams input chunks
   - Uses `ffmpeg` to transcode/concat
   - Uploads output to Cloudflare R2 via `s3Client`
   - Updates DB rows

### Enqueuing Tasks (Best Practices)

- Queue package defines a central `TaskMap`:

  - Keys: Celery task name strings (e.g. `"tasks.concatAudioFile"`).
  - Values: TypeScript payload types (usually `z.infer<...>` from the target `queueProcedure` input schema).
  - `TaskName = keyof TaskMap`
  - `TaskPayload<N> = TaskMap[N]`

- `TASK_NAMES`

  - Nested tree of string literals for ergonomic imports.
  - Example: `TASK_NAMES.concatAudioFile === "tasks.concatAudioFile"`.
  - All leaf values in `TASK_NAMES` are a subset of `TaskName`.

- **Preferred helper**: `enqueueTask` from `packages/trpc/src/queue/enqueue.ts`

  ```ts
  enqueueTask<N extends TaskName>(name: N, payload: TaskPayload<N>);
  ```

  - For tasks whose payload is `void` in `TaskMap`, payload is optional:  
    `enqueueTask(TASK_NAMES.queueAllPostsToScore)`.

  - Internally:
    - Awaits a single Redis readiness gate via `client.isReady()`.
    - Reuses a cached Celery `Task` instance per task name.
    - Normalizes calling convention to pass a single payload object.

**Type-safe example**

```ts
import { enqueueTask } from "@workspace/trpc/src/queue/enqueue";
import { TASK_NAMES } from "@workspace/trpc/src/queue";

await enqueueTask(TASK_NAMES.createAudioFileChunks, {
  audioFileId,
  chunkSize: 500,
  includeTitle: true,
});

// Void-payload example:
await enqueueTask(TASK_NAMES.queueAllPostsToScore);
```

**Do / Don’t**

- ✅ Do pass a single object payload that matches the Zod schema of the target `queueProcedure`.
- ❌ Don’t pass arrays as the payload.
- ✅ Do batch with `Promise.all` when enqueuing many tasks.
- ✅ Keep payloads small and idempotent.
- ✅ Prefer `enqueueTask` to avoid piling up `ready` listeners on Redis.
- If you must use the low-level client:

  - Call `await client.isReady()` once.
  - Reuse a cached `Task` instance.

- Keep task handlers idempotent:
  - Use unique constraints and `upsert` patterns where possible.

### Cron Scheduler (Bun + node-cron)

- Location: `apps/cron`
- Runtime: **Bun**
- Scheduler: `node-cron` (`import cron from "node-cron"`).
- Purpose: Trigger lightweight, scheduled tasks that make single-line tRPC calls using a queue context and defer heavy work to workers.

**Files**

- `apps/cron/index.ts`
  - Registers cron schedules (e.g. `"0,10,20,30,40,50 * * * *"`).
- `apps/cron/trpc.ts`
  - Builds a server-to-server tRPC caller:

```ts
import { createCaller, createQueueContext } from "@workspace/trpc/server";
const ctx = await createQueueContext({ apiKey: "1113" });
export const api = createCaller(ctx);
```

**Initial job**

- Calls `await api.debug.helloWorld()` on each tick.
- `debug.helloWorld` is a `queueProcedure` that logs `"hello world"` in the cron app’s console.

**Best practices**

- Keep cron jobs to single-line tRPC calls; avoid heavy logic in the cron process.
- Expose cron-callable procedures as `queueProcedure` so they’re server-to-server only.
- Make cron-triggered operations idempotent and fast.
- Push long-running work to `apps/queue` via existing tRPC endpoints.
- Log clearly and catch errors around each scheduled call.
- Prefer configuration via code; if env is needed, add `.env` under `apps/cron` and read via `process.env`.

---

## Database Layer

- **Prisma schema**: `packages/database/prisma/schema.prisma` (PostgreSQL).

  **Notable models**

  - Auth:
    - `User`, `Session`, `Account`, `Verification` (Better Auth tables)
  - Product:
    - `Speaker`, `AudioFile`, `AudioChunk`, `AudioFileSettings`, `UserAudioFile`
  - Billing:
    - `Subscriptions` (FREE/BASIC/PRO), `Credits`
  - Utility:
    - `KeyValueStore`, `SupportSubmission`, `Emails`

- **Client export**

  - `@workspace/database` exports a singleton Prisma client (`prisma`) and types.
  - Import directly:  
    `import { prisma } from "@workspace/database"`.
  - Inside tRPC, prefer `ctx.db`.

- **Migrations and codegen** (run from repo root or `packages/database`):

  - `bun -w packages/database run generate` – generate Prisma client.
  - `bun -w packages/database run db:migrate:dev` – create/apply migrations.
  - `bun -w packages/database run studio` – open Prisma Studio.

---

## Emails (Transactional)

- Templates live in `packages/transactional/emails`.
- Built with `@react-email/components` using shared layout and tokens:

  - Components: `packages/transactional/src/components.tsx`
  - Styles: `packages/transactional/src/styles.ts`
  - Example template: `packages/transactional/emails/welcome.tsx`

- Send with **Resend** by passing a React tree.

  - Context path:  
    `packages/trpc/src/context.ts:82` – sends `WelcomeEmail` after Stripe customer creation.
  - Router path:  
    `packages/trpc/src/routers/emails.ts:23` – sends `WelcomeEmail` on join.

- **Adding a template**

  1. Create `packages/transactional/emails/<name>.tsx`.
  2. Export it from `packages/transactional/src/index.ts`.
  3. Call from a tRPC procedure:

     ```ts
     await resend.emails.send({
       from,
       to,
       subject,
       react: <YourTemplate />,
     });
     ```

- **Asset base URL**

  - Templates read `process.env.FRONTEND_URL` in `EmailLayout` to build absolute image links.

---

## Storage and Media

- **Cloudflare R2**

  - Accessed via AWS SDK S3 client.
  - Implementation: `packages/trpc/src/s3.ts`.

- **Presigned uploads for images**

  - tRPC router: `packages/trpc/src/routers/images.ts`.

- **Audio processing**
  - Uses `ffmpeg-static` in workers to process audio (transcode, concat, etc.).

---

## Auth

- **Better Auth setup**: `packages/trpc/src/lib/auth.ts`

  - Uses Prisma adapter.
  - Plugins: `nextCookies`, `admin`, `expo`.

- **Next.js route**

  - `apps/web/app/api/auth/[...all]/route.ts`.

- **tRPC context**

  - Uses `auth.api.getSession({ headers })` for session resolution.

- **Stripe & welcome email side effects**
  - On first authenticated context without a `stripeCustomerId`:
    - A Stripe customer is created.
    - A welcome email can be sent via Resend.

---

## Stripe Webhooks

- **Entry route**

  - `apps/web/app/api/webhooks/stripe/route.ts`
  - Reads raw body via `await req.text()`.
  - Verifies the `stripe-signature` header using:
    - `stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)`
  - Delegates to `handleStripeEvent(event)`.
  - Returns JSON 200 on success.

- **Dispatcher**

  - `apps/web/app/api/webhooks/stripe/handler.ts`
  - Switches on `event.type` and calls a per-event handler.
  - Example cases:
    - `payment_intent.succeeded`
    - `invoice.paid`
    - `customer.subscription.deleted`
    - `checkout.session.completed`

- **Per-event handlers**

  - One file per Stripe event in the same folder.
  - Filename mirrors the Stripe event type string.

  **Examples**

  - `apps/web/app/api/webhooks/stripe/checkout.session.completed.ts`  
    → `handleCheckoutSessionCompleted(event: Stripe.CheckoutSessionCompletedEvent)`  
    → Expands line items and credits users based on `env.ONE_M_CREDIT_PRICE`.

  - `apps/web/app/api/webhooks/stripe/invoice.paid.ts`  
    → `handleInvoicePaid(event: Stripe.InvoicePaidEvent)`  
    → Maps price ids to `SubscriptionPlans` via `env.STRIPE_BASIC_PLAN` and `env.STRIPE_PRO_PLAN`, upserts `subscriptions` and `credits`.

  - `apps/web/app/api/webhooks/stripe/customer.subscription.deleted.ts`  
    → `handleCustomerSubscriptionDelete(event: Stripe.CustomerSubscriptionDeletedEvent)`  
    → Sets plan to `FREE` and clears `stripeSubscriptionId`.

  - `apps/web/app/api/webhooks/stripe/payment_intent.succeeded.ts`  
    → Placeholder handler typed as `Stripe.PaymentIntentSucceededEvent`.

- **Naming convention**

  - Use the exact Stripe event type string as the filename, preserving punctuation:
    - `checkout.session.completed.ts`
    - `invoice.paid.ts`
    - `payment_intent.succeeded.ts`
    - `customer.subscription.deleted.ts`
  - Export a function named `handle<EventCamelCase>` receiving the specific typed `Stripe.<EventName>Event`.
  - Add a `case "<event.type>"` in `handler.ts` that calls your new function.

---

## Global Singletons

**Purpose**

- Keep one instance of SDK/clients during dev hot reloads.
- Avoid duplicate connections and memory leaks.

**Pattern (attach to `global` / `globalThis`)**

- Example approach:

  ```ts
  const globalForX = global as unknown as { x: Type };
  export const x = globalForX.x || new Type(/* ... */);

  if (process.env.NODE_ENV !== "production") {
    globalForX.x = x;
  }
  ```

- Alternatively:

  ```ts
  declare global {
    var __name__: Type | undefined;
  }

  export const x = (globalThis.__name__ ??= new Type());
  ```

**Examples**

- Prisma client:
  - `packages/database/src/client.ts:3`
- Stripe client:
  - `packages/trpc/src/lib/stripe/index.ts:5`
- Resend client:
  - `packages/trpc/src/lib/resend/index.ts:5`
- Celery queue client:
  - `packages/trpc/src/queue/client.ts:3`
- Task cache via `globalThis`:
  - `packages/trpc/src/queue/enqueue.ts:11`
  - `packages/trpc/src/queue/enqueue.ts:21`

**Notes**

- Prefer reuse form (`globalForX.x || new Type()`) so hot reloads don’t create multiple instances.
- Some modules (e.g., Celery client) may instantiate unconditionally; mirror the Prisma pattern if you need reuse.

---

## Environment Variables

**Sources**

- Shared server env (tRPC and workers):  
  `packages/trpc/src/env.ts`
- Next.js app env:  
  `apps/web/env.ts`

**Implementation**

- Uses `@t3-oss/env-nextjs` + Zod to validate at startup/build and provide typed access via `env`.
- Two schemas per file:
  - `server`: server-only keys (never exposed to the browser).
  - `client`: browser-exposed keys (must be prefixed with `NEXT_PUBLIC_`).
- `runtimeEnv`:
  - Explicit mapping from `process.env` to satisfy edge/client constraints.
  - Avoids destructuring `process.env` directly.
- `skipValidation`:
  - `SKIP_ENV_VALIDATION=1` bypasses checks (useful in Docker builds or partial local setups).
- `emptyStringAsUndefined: true`:

  - Empty strings are treated as missing and fail validation.

- `packages/trpc/src/env.ts`:
  - Calls `dotenv.config()` to load `.env` before validation for Node runtimes.
- `apps/web/env.ts`:
  - Relies on Next’s env loading.

**Adding a variable**

```ts
// packages/trpc/src/env.ts
server: { MY_SECRET: z.string() },
client: { NEXT_PUBLIC_FOO: z.string().url() },
runtimeEnv: {
  MY_SECRET: process.env.MY_SECRET,
  NEXT_PUBLIC_FOO: process.env.NEXT_PUBLIC_FOO,
}
```

**Using a variable**

- Server only:  
  `import { env } from "../env"; env.MY_SECRET`
- Client safe (Next app env):  
  `env.NEXT_PUBLIC_FOO` (from `apps/web/env.ts`)

**Where to set values**

- Next.js app: `apps/web/.env`
- Queue worker: `apps/queue/.env`
- Cron: `apps/cron/.env`
- Shared server libs: rely on the process’s env;
  - `.env` in `packages/trpc/` is supported by its `dotenv.config()` when that package is the entrypoint.

---

## UI & UX Patterns

### Forms (Zod + React Hook Form)

- Define a Zod schema and infer types.
- Integrate with `react-hook-form` via `zodResolver`.

  - Example schema: `apps/web/components/feedback-form.tsx:17`
  - Form setup:  
    `useForm({ resolver: zodResolver(Schema), defaultValues, mode: "onChange" })`
  - Submit with tRPC mutation:  
    `api.support.submit.useMutation()` and `form.handleSubmit(onSubmit)`.
  - Render with shadcn form primitives:
    - `Form`
    - `FormField`
    - `FormItem`
    - `FormLabel`
    - `FormMessage`

**Snippet**

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
  <form
    onSubmit={form.handleSubmit((v) => save.mutate(v))}
    className="space-y-6"
  >
    {/* EMAIL FIELD */}
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Email (optional)</FormLabel>
          <Input type="email" placeholder="you@example.com" {...field} />
          <FormMessage />
        </FormItem>
      )}
    />

    {/* MESSAGE FIELD */}
    <FormField
      control={form.control}
      name="message"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Message</FormLabel>
          <Textarea placeholder="Write your message here..." {...field} />
          <FormMessage />
        </FormItem>
      )}
    />

    {/* SUBMIT BUTTON */}
    <Button type="submit" disabled={save.isLoading}>
      {save.isLoading ? "Sending..." : "Submit"}
    </Button>
  </form>
</Form>;
```

### Responsive Modal (Dialog/Drawer)

Use the responsive modal to render a desktop Dialog and a mobile Drawer from a single component.

- Component: `apps/web/components/resonpsive-modal.tsx`
- Props:
  - `open: boolean`
  - `onOpenChange: (v: boolean) => void`
  - `title: string`
  - `description?: string`
  - `children?: React.ReactNode`
- Behavior:
  - Uses `Dialog` for desktop (≥ `MEDIA_QUERY.MD`).
  - Uses `Drawer` for mobile (< `MEDIA_QUERY.MD`).

**Example**

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

### Icon-Only Buttons (Tooltips)

When creating icon-only buttons:

- Wrap the button in a `Tooltip` with `TooltipTrigger asChild`.
- Provide an `aria-label` on the `Button`.
- Set `TooltipContent` to a short description of the action.

**Example**

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="outline"
      size="icon"
      aria-label="Refresh evaluations"
      onClick={() => refetch()}
      disabled={isFetching}
    >
      {isFetching ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
    </Button>
  </TooltipTrigger>
  <TooltipContent>Refresh evaluations</TooltipContent>
</Tooltip>
```

### Pagination Patterns

**Default recommendation (tables in `apps/web`)**

- Prefer **numbered pagination** (page/pageSize + total) using shared `PaginationBar`.
- Use **cursor/infinite** pagination only for true feeds or infinite scroll UX.

#### Approach 1 – Numbered Pagination (preferred for tables)

**When to use**

- Admin/data tables.
- Filterable lists.
- Jump-to-page UX.
- “X–Y of Z” summaries.

**API shape**

- Input: `{ page, pageSize, ...filters }`
- Output: `{ items, total }`

**DB query**

- `skip: (page - 1) * pageSize`
- `take: pageSize`
- `orderBy: <stable>`
- Mirror filters in a matching `count()`.

**Client usage**

- Keep `page` state.
- Compute `totalPages = Math.ceil(total / pageSize)`.
- Render `PaginationBar`.
- Reset `page` to 1 when filters/search change.
- Debounce search inputs.

**Pros**

- Simple UX.
- Easy to share specific pages.
- Natural for server-rendered admin tables.

**Tradeoffs**

- Requires `count()`, which can be expensive on huge datasets.
- Must use stable `orderBy` to avoid duplicates/omissions.

#### Approach 2 – Cursor (Infinite) Pagination

**When to use**

- Infinite scroll feeds.
- Activity timelines.
- Very large lists where `count()` is costly or unnecessary.

**API shape**

- Input: `{ limit, cursor?, ...filters }`
- Output: `{ items, nextCursor }`

**DB query**

- `take: limit + 1`
- `orderBy: <stable>`
- Optional `cursor`.
- If `items.length > limit`, pop extra and set `nextCursor`.

**Client usage**

- `useInfiniteQuery` with `getNextPageParam: (last) => last.nextCursor`.
- Merge pages: `data.pages.flatMap((p) => p.items)`.

**Pros**

- Efficient for endless lists.
- Avoids expensive counts.
- Resilient to concurrent inserts.

**Tradeoffs**

- No built-in notion of total pages.
- Harder to jump to arbitrary positions.

**References**

- **Numbered pattern**

  - Frontend:  
    `apps/web/app/(admin)/admin/_components/admin-users.tsx`  
    `apps/web/app/(admin)/admin/leads/page.tsx`  
    `apps/web/components/pagination-bar.tsx`
  - tRPC:  
    `packages/trpc/src/routers/users.ts` (`adminList`)  
    `packages/trpc/src/routers/reddit.ts` (`listPosts`)

- **Cursor pattern**
  - Server:  
    `packages/trpc/src/routers/audio.ts`  
    `packages/trpc/src/routers/favoritesRouter.ts`
  - Client:  
    `apps/web/components/audio/audio-history.tsx`  
    `apps/web/components/audio/audio-file-favorites.tsx`

**Implementation checklist**

- Always use deterministic `orderBy`.
- Mirror filters between `findMany` and `count()`.
- Debounce free-text search.
- Reset `page` when filters change.
- Disable Prev/Next at bounds.
- Show “Showing X–Y of Z” when using numbered pagination.

### URL Query State (nuqs `useQueryState`)

**Purpose**

- Keep UI state in URL search params so it’s shareable, deep-linkable, and persists on refresh/back/forward.

**Library**

- `useQueryState` from `nuqs`.
- Parsers like `parseAsString` define how a param is read/written.

**Client-only**

- Use inside client components (`"use client"` at top of file).

**Basic example (mode switcher)**

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

**Usage notes**

- Drives conditional UIs, e.g. swapping forms based on `mode`.
- See `apps/web/app/(app)/audio-file/new/new.audio.client.tsx` for a working usage.
- `parseAsString.withDefault("")` provides a value when the param is missing.
- `setMode(value)` pushes a new value into the URL; use default to “reset”.
- Keep param keys stable; avoid frequent renames.

---

## Common Workflows

- **Create audio**

  - Use tRPC mutations under `audio`, `workers`, and `workers.ai` routers.
  - Pipeline:
    - Enqueue tasks
    - Create chunks
    - Render and concat
    - Produce MP3 in R2

- **Manage speakers**

  - `speakers` router:
    - CRUD
    - Example audio generation.

- **Billing**

  - `stripe` and `subscriptions` routers.
  - `credits` router for one-off purchases.

- **Admin**
  - Guarded by `adminProcedure`.
  - UI under `apps/web/app/(admin)`.

---

## Running Locally

1. **Prereqs**

   - Node 20+
   - Bun
   - Docker

2. **Start infra**

   - `docker compose up -d`  
     (Postgres, RabbitMQ, Redis)

3. **Generate Prisma client**

   - `bun -w packages/database run generate`

4. **Migrate DB**

   - `bun -w packages/database run db:migrate:dev`

5. **Dev servers**

   - From repo root:
     - `bun run dev`  
       (Turbo runs app dev scripts)
   - Or run individually:
     - Web: `cd apps/web && bun run dev`
     - Queue: `cd apps/queue && bun run dev`
     - Cron: `cd apps/cron && bun run dev`

6. **Optional: Stripe webhook forwarding**
   - `bun -w apps/web run stripe`

---

## Troubleshooting

- **Prisma client missing**

  - Run `bun -w packages/database run generate`.

- **Env validation failing**

  - Set required keys in appropriate `.env`.
  - Or use `SKIP_ENV_VALIDATION=1` while developing non-affected areas.

- **Queue tasks not running**

  - Ensure:
    - `BROKER` and `REDIS_URL` set in both web and queue envs.
    - `docker compose up` is running.
    - `apps/queue` is started.

- **R2 upload issues**

  - Validate:
    - R2 endpoint
    - Bucket name
    - Credentials
  - Check that bucket policy allows the operation.

- **Auth/Stripe flows**
  - If not needed locally:
    - Avoid logging in.
  - Otherwise:
    - Provide valid Stripe/Resend/etc. keys.

---

## Conventions and Tips for Agents

- Validate all inputs with **Zod** in every procedure.
- Use `ctx.db` (Prisma) for all DB access from tRPC.
- Keep routers cohesive and small; compose them in `router.ts`.
- Choose the right `Procedure`:

  - `publicProcedure` for read-only public access.
  - `authenticatedProcedure` for user-specific queries/mutations.
  - `adminProcedure` for admin-only.
  - `queueProcedure` for background/server-to-server work.

- For background work:

  - Enqueue tasks via queue helpers (`packages/trpc/src/queue/enqueue.ts`),
  - Implement worker logic as `queueProcedure` mutations.

- Prefer server-side tRPC calls (RSC) for:
  - SSR
  - Hydration
- Use React tRPC client only in client components when needed.

- Follow existing style/structure and avoid unrelated refactors.
- Keep operations idempotent whenever they might be retried:
  - Especially queue/cron flows.

---

## Quick Anchors

- App router: `packages/trpc/src/router.ts`
- Context: `packages/trpc/src/context.ts`
- Web RSC tRPC: `apps/web/trpc/server.ts`
- Web client tRPC: `apps/web/trpc/react.tsx`
- Prisma schema: `packages/database/prisma/schema.prisma`
- Worker wiring: `apps/queue/index.ts`
- Worker routers: `packages/trpc/src/routers/workers.ts`
- Cron entry: `apps/cron/index.ts`
- Cron tRPC caller: `apps/cron/trpc.ts`
- Env schema: `packages/trpc/src/env.ts`
- R2 client: `packages/trpc/src/s3.ts`
- Emails: `packages/transactional/emails/welcome.tsx`
