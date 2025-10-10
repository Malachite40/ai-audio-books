You are working in this monorepo. Start all local services and dev servers.

Steps:
- Ensure prerequisites installed: Node 20+, Bun, Docker.
- Start infra: run `docker compose up -d` from repo root.
- Generate Prisma client: run `bun -w packages/database run generate`.
- Apply/migrate DB (dev): run `bun -w packages/database run db:migrate:dev`.
- Start dev servers: run `bun run dev` from repo root (Turbo runs `apps/web` and `apps/queue`).
- Optional: Stripe webhook forwarding: run `bun -w apps/web run stripe`.

Notes:
- tRPC entry: `apps/web/app/api/trpc/[trpc]/route.ts`
- RSC helper: `apps/web/trpc/server.ts`
- React client provider: `apps/web/trpc/react.tsx`
- Prisma schema: `packages/database/prisma/schema.prisma`

