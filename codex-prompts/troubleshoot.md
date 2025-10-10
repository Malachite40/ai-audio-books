Troubleshoot common local issues in this repo.

Checklist:
- Prisma client missing? Run: `bun -w packages/database run generate`.
- Env validation failing? Set missing keys or use `SKIP_ENV_VALIDATION=1` temporarily when working on unaffected areas.
- Queue tasks not running? Ensure Docker infra is up: `docker compose up -d`; verify `BROKER` and `REDIS_URL` set in web and queue envs; start `apps/queue`.
- R2 upload issues? Validate endpoint, bucket, credentials; ensure bucket allows the operation.
- Auth/Stripe flows flaky locally? Avoid logging in unless needed; otherwise provide valid keys.

Pointers:
- Context/auth bootstrap: `packages/trpc/src/context.ts`
- Queue client/tasks: `packages/trpc/src/queue/*`
- R2 client: `packages/trpc/src/s3.ts`
- Web tRPC: `apps/web/trpc/server.ts`, `apps/web/trpc/react.tsx`

