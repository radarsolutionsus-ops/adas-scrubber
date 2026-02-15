# Architecture Blueprint

## Pillar 1: Presentation

- Next.js App Router UI under:
  - `src/app/(auth)`
  - `src/app/(protected)`
- Light, field-friendly interface with drag-and-drop estimate intake.

## Pillar 2: API / Application Services

- Route handlers under `src/app/api/*`.
- Clear endpoint boundaries: scrubbing, learning, billing, usage, reports, health.
- Auth and rate-limits applied to protected routes.

## Pillar 3: Domain Intelligence

- `src/lib/scrubber.ts` - line-level calibration trigger matching.
- `src/lib/estimate-parser.ts` - VIN/metadata/reference extraction.
- `src/lib/calibration-normalization.ts` - dedupe/grouping normalization.
- `src/lib/report-pdf.tsx` - report generation with operation hierarchy.

## Pillar 4: Data Layer

- Prisma schema in `prisma/schema.prisma`.
- Local runtime uses SQLite for zero-friction development.
- Deployment path uses Supabase/PostgreSQL for scale.
- Core entities:
  - shop/subscription/usage/report
  - vehicle/adas system/repair maps
  - learning rules/events
  - webhook events (idempotency)

## Pillar 5: Identity & Access

- Auth.js credentials provider (`src/auth.ts`).
- Session-enforced access in middleware and route handlers.
- Protected UX routes: `/dashboard`, `/scrub`.

## Pillar 6: Billing & Monetization

- Stripe Checkout and Billing Portal endpoints.
- Webhook-driven subscription status synchronization.
- Dedupe tracking prevents duplicate webhook side-effects.

## Pillar 7: Security & Operations

- Security headers + CSP in middleware.
- Same-origin guard for mutating API traffic.
- Endpoint rate limiting.
- Health endpoints for liveness/readiness checks.
- Dockerfile + `.dockerignore` for reproducible deploys.
