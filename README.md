# ProofLayer AI

Clean restart — **Phase 1 foundation only**.

## Product loop (Phase 1)

1. Enterprise creates a QC case
2. Field worker sees available cases
3. Field worker accepts a case
4. Data persists in Supabase after refresh

## Not in this repo yet

Uploads, Gemini, geo enforcement, reports, analytics, audit logs, in-memory store, or legacy migrations.

## Setup (when implementation lands)

```bash
cp .env.example .env.local
# Apply supabase/migrations/001_foundation.sql to a new Supabase project
npm install
npm run dev
```

## Demo accounts (seeded in migration)

| Role | Email | Password |
|------|-------|----------|
| Enterprise | `alex@prooflayer.ai` | `demo123` |
| Field | `jordan@prooflayer.ai` | `demo123` |

## Archived work

Previous unstable builds live in [prooflayer-ai_discarded](https://github.com/IsabelEscobarRivas/prooflayer-ai_discarded).
