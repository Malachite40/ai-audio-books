# @workspace/cron

Cron scheduler for server-to-server tRPC calls using Bun and node-cron.

- Entry: `index.ts`
- tRPC caller: `trpc.ts`
- Schedule: `0,10,20,30,40,50 * * * *` → `api.debug.helloWorld()`

## Dev

```bash
bun -w apps/cron run dev
# or from repo root if using turbo:
bun run dev
```

