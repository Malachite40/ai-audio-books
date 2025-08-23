# Simple, dev-friendly image that runs the queue with Bun
FROM oven/bun:1.1

# Work in repo root so Bun can see workspaces
WORKDIR /app

# Copy everything (simple mode)
COPY . .

# Install all deps (works with npm/yarn/pnpm lockfiles too)
RUN bun install

ENV NODE_ENV=production

RUN bun run build --filter=@workspace/trpc

# Start the queue. This uses apps/queue/package.json "start"
# e.g. "start": "bun run ./index.ts"
CMD ["bun", "run", "start", "--filter=queue"]
