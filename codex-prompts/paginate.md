Implement cursor pagination on a list endpoint.

Arguments:
- Router name: `$1` (e.g., `audio`)
- Procedure name: `$2` (e.g., `list`)
- Prisma model: `$3` (e.g., `audioFile`)
- OrderBy field: `$4` (e.g., `createdAt` DESC)
- Page size: `$5` (default 20)

Do:
1) In `packages/trpc/src/routers/$1.ts`, add `.$2` with input `{ limit?: number, cursor?: string }`.
2) Query with `take = (limit ?? $5) + 1`, `skip = cursor ? 1 : 0`, `cursor: cursor ? { id: cursor } : undefined`, and `orderBy: { $4 }`.
3) If results length > limit, `pop()` the extra item and set `nextCursor = last.id`.
4) Return `{ items, nextCursor }`.
5) Client example: use `api.$1.$2.useInfiniteQuery({ limit }, { getNextPageParam: (last) => last.nextCursor })` and merge via `data.pages.flatMap(p => p.items)`.

Notes:
- See examples: `packages/trpc/src/routers/audio.ts:82`, `packages/trpc/src/routers/favoritesRouter.ts:77`.

