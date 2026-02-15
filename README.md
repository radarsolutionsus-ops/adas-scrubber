# ADAS Scrubber

Production-oriented ADAS estimate scrubbing platform for collision shops.

## Seven Pillars (Implemented)

1. `Presentation` - polished Next.js App Router UI for auth, dashboard, and estimate scrub workflows.
2. `API/Application` - typed route handlers in `src/app/api/*` with auth checks and rate limits.
3. `Domain Intelligence` - VIN decode, estimate parsing, calibration normalization, PDF reporting.
4. `Data` - Prisma ORM with local SQLite runtime and Supabase/PostgreSQL deployment path.
5. `Identity & Access` - Auth.js credentials flow with protected routes + middleware enforcement.
6. `Billing` - Stripe Checkout, Billing Portal, webhook sync, and webhook idempotency tracking.
7. `Security & Ops` - CSP/security headers, same-origin API mutation guard, API rate limits, health endpoint, container deployment.

## Stack

- Next.js 16 (App Router)
- Prisma ORM
- SQLite (local dev)
- PostgreSQL / Supabase Postgres (production scaling)
- Auth.js (NextAuth v5)
- Stripe (REST API integration)
- React PDF Renderer

## Environment

Copy and complete envs:

```bash
cp .env.example .env
```

Required keys:

- `DATABASE_URL`
- `AUTH_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `USAGE_RESET_MODE` (`calendar` or `billing`)

Stripe (for billing):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STANDARD`

OpenAI (optional, improves PDF estimate extraction on difficult files):

- `OPENAI_API_KEY`
- `OPENAI_PDF_MODEL` (default `gpt-4.1-mini`)

## Local Setup

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

## Billing Endpoints

- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `POST /api/billing/webhook`

## Learning / Agentic Corrections

Manual corrections are persisted in PostgreSQL:

- `LearningRule` table: reusable add/suppress rules by shop + vehicle profile
- `LearningEvent` table: correction audit trail and trigger evidence

Future scrubs automatically apply learned rules for the same shop/vehicle scope.

## Security Controls

- Security headers via middleware (CSP, HSTS, frame/ctype/referrer policies)
- Same-origin guard for mutating `/api/*` requests
- Endpoint-level rate limiting on scrub, learning, reports, dashboard, events, usage, and billing
- Stripe webhook signature verification + dedupe via `WebhookEvent`

## Deployment

### Option A: Managed platform (recommended)

Deploy on Vercel/Railway/Fly with Supabase Postgres.

- In production, point `DATABASE_URL`/`DIRECT_URL` to Supabase Postgres and run schema sync before startup.
- Optional seed (one-time): `npm run db:seed`

### Option B: Docker

```bash
docker build -t adas-scrubber .
docker run --env-file .env -p 3000:3000 adas-scrubber
```

## Health Check

- Liveness: `GET /api/health`
- Readiness (DB): `GET /api/health?strict=1`
