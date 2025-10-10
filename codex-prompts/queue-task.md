Add a background task via the queue and wire worker-side logic.

Arguments:
- Task name: `$1` (unique identifier)
- tRPC enqueue location (router.procedure): `$2` (e.g., `workers.startJob`)
- Input schema/fields: `$3`
- Worker implementation summary: `$4`

Do:
1) Enqueue: in `packages/trpc/src/queue/client.ts` (or calling site in `packages/trpc/src/routers/*.ts`), add a function to publish `$1` with `$3`.
2) Define a tRPC mutation (likely under `workers` or feature router) to validate inputs with Zod and enqueue `$1`.
3) Worker: implement handling in `apps/queue`:
   - Entry: `apps/queue/index.ts`
   - tRPC caller: `apps/queue/src/trpc.ts`
   - Add logic per `$4`, calling queue-side tRPC via `createQueueContext` where needed.
4) For long jobs that touch storage, use R2 client: `packages/trpc/src/s3.ts`.
5) Persist progress/status in DB via `ctx.db` from queue-context procedures.

Notes:
- Review `packages/trpc/src/routers/workers.ts` and `packages/trpc/src/routers/workers/ai.ts` for patterns (chunking, concat, uploads).

