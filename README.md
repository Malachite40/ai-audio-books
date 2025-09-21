# InstantAudio.online (ai-audio-books)

InstantAudio.online is a full-stack platform for turning long-form text (books, articles, scripts) into polished audiobooks using AI-powered text-to-speech. It supports chapter detection, voice selection, and single-file MP3 exports. The app is designed for speed, quality, and ease of use, with support for web, mobile, and cloud workers.

## Features

- **AI Audiobook Generation**: Paste or upload text, select a voice, preview, and render a full audiobook.
- **Chapter Detection & Stitching**: Automatically splits and stitches chapters for smooth listening.
- **Voice Library**: Curated neural voices tuned for narration; advanced plans allow custom voices and SSML controls.
- **Single File Export**: Download as MP3 (with chapter markers); M4B support for higher tiers.
- **Rollover Credits**: Unused character credits roll over while your subscription is active.
- **Commercial & Non-Commercial Use**: Starter plan is non-commercial; higher tiers allow commercial use.
- **Web & Mobile Apps**: Built with Next.js (web), Expo (mobile), Cloudflare Workers, and a queue system for scalable processing.
- **Admin Dashboard**: Manage speakers, submissions, and audio jobs.

## Tech Stack

- **Frontend**: Next.js, React, Expo
- **Backend**: Node.js, TRPC, Prisma, PostgreSQL
- **Cloud**: Cloudflare Workers, S3/R2 for audio storage
- **Queue**: Celery-node for distributed task processing
- **Auth**: Better Auth (Google, Apple, Expo)

## Usage

1. Paste or upload your text.
2. Pick a voice and preview a short clip.
3. Render the full audiobook and download/export.
4. Share a link or keep it private.

## Plans & Pricing

- **Starter**: 20k chars/month (~0.5h), unlimited rollover, basic features.
- **Basic**: 1M chars/month (~25h), unlimited rollover, more voices, longer jobs.
- **Pro**: 5M chars/month (~125h), fastest turnaround, all features, commercial use.

See `/apps/web/app/(app)/subscribe/pricing-plan-data.ts` for full feature breakdown.

## How to Run the App

This project uses a Turborepo monorepo structure. You only need to run the following commands in the root directory:

### Prerequisites

- Install [Bun](https://bun.sh/)
- (Optional) Install [Node.js](https://nodejs.org/) and [Expo CLI](https://docs.expo.dev/get-started/installation/) if you want to work directly with mobile or Node tools.
- (Optional) Install [Docker](https://www.docker.com/) if you want to run services in containers.

### Start All Containers (Docker)

```sh
docker compose up --build
```

This will build and start all services defined in `docker-compose.yml` in containers. **Start containers before running the app.**

### Start All Apps (Turborepo)

```sh
bun install
bun run dev
```

This will start all apps and packages in development mode using Turborepo. You do not need to run commands in individual app folders.

### Database & Environment

- Ensure your database and environment variables are configured (see `.env.example` or relevant docs).

---

## Development

- Monorepo structure: `apps/` (web, mobile, cloudflare, queue), `packages/` (trpc, database, ui, etc.)

## License & Contribution

- You own the audio you generate (see Terms for details).
- Contributions welcome! Open issues or PRs.

---

For more, visit [InstantAudio.online](https://instantaudio.online) or see the FAQ in the web app.
