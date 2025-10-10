Add a new tRPC procedure in this repo.

Arguments:
- Router name: `$1` (file at `packages/trpc/src/routers/$1.ts`)
- Procedure name: `$2`
- Access: `$3` (public|authenticated|admin|queue)
- Input Zod schema (inline or describe): `$4`
- Implementation summary (what it should do): `$5`

Do:
1) Open `packages/trpc/src/routers/$1.ts`. If file doesn’t exist, create a new router file using existing routers as a template and export it.
2) Import from `../trpc`: `createTRPCRouter`, plus the right procedure helper based on `$3`:
   - public -> `publicProcedure`
   - authenticated -> `authenticatedProcedure`
   - admin -> `adminProcedure`
   - queue -> `queueProcedure`
3) Define input with Zod: `input($4)` if provided, else `.input(z.void())`.
4) Implement `$2` as a `.query` or `.mutation` using `ctx.db` for DB access per AGENT_README conventions. Follow cohesive router patterns.
5) Wire the router in `packages/trpc/src/router.ts` so it’s part of `appRouter`.
6) Provide usage examples:
   - RSC: `const data = await api.$1.$2(/* input */);`
   - Client: `const { data } = api.$1.$2.useQuery(/* input */);` or `.useMutation()`.

Constraints:
- Validate all inputs with Zod.
- Keep router cohesive and small.
- Do not refactor unrelated code.
- Use `ctx.db` (Prisma) and follow existing style.

