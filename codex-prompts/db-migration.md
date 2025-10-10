Add or update a Prisma model and run a dev migration.

Arguments:
- Model changes (schema.prisma diff/description): `$1`

Do:
1) Edit `packages/database/prisma/schema.prisma` to apply `$1`.
2) From repo root, generate Prisma client: `bun -w packages/database run generate`.
3) Create and apply a dev migration: `bun -w packages/database run db:migrate:dev`.
4) If tRPC needs new types/queries, add them under `packages/trpc/src/routers/*` following conventions.

Notes:
- Client wrapper: `packages/database/src/client.ts`.

