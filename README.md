# ProofLayer AI

**Phase 1 foundation** per [ADR-001](docs/adr/001-phase1-foundation.md).

## Scope

| In scope | Out of scope |
|----------|----------------|
| `prooflayer` schema: organizations, users, qc_cases, assignments | Evidence, storage, Gemini, evaluations |
| REST API (ADR §6) | RLS, audit/events, geo, reports |
| Supabase service-role server access | JSONB, demo seeds, in-memory store |

## Database

```bash
# Supabase SQL Editor — run once on a new project:
# supabase/migrations/001_foundation.sql
```

- Schema: **`prooflayer`** (not `public`)
- UUID PKs; `users.id` = `auth.users.id` (no default)
- `updated_at` via trigger only
- No seed data in migration

## Environment

```bash
cp .env.example .env.local
```

## Docs

- [ADR-001](docs/adr/001-phase1-foundation.md)
- [QA checklist](docs/PHASE1_QA_CHECKLIST.md)
- [SQL smoke test](docs/PHASE1_SMOKE_TEST.md)

## Archived

Previous builds: [prooflayer-ai_discarded](https://github.com/IsabelEscobarRivas/prooflayer-ai_discarded)

## Status

**Migration:** ADR-001 aligned  
**Application:** not yet implemented — Next.js API + UI pending
