# ADR-001: Phase 1 Foundation — Database & Persistence

| Field | Value |
|-------|-------|
| Status | **APPROVED** |
| Version | 1.0 |
| Date | 2026-05-19 |
| Scope | `prooflayer` schema: organizations, users, qc_cases, assignments |

See team-approved full text in project documentation. This file is the canonical reference for Phase 1 implementation.

## Implementation mapping

| ADR | Repo artifact |
|-----|----------------|
| §3 Schema | `supabase/migrations/001_foundation.sql` |
| §5 Indexes | Same migration |
| §6 API | `src/app/api/*` (to be implemented) |
| §11 QA checklist | `docs/PHASE1_QA_CHECKLIST.md` |

## Product loop (Phase 1)

1. Enterprise creates QC case (`POST /api/qc-cases`, status → `open`)
2. Field lists available cases (`GET /api/qc-cases?organization_id=&status=open`, exclude cases with active assignment)
3. Field accepts via assignment (`POST /api/assignments`, `assigned_to` = self, `status` → `in_progress` via PATCH or create)
4. Refresh — rows read only from `prooflayer.*` tables

## Out of scope (Phase 1)

Evidence, storage, Gemini, evaluations, RLS, audit/events tables, geo, reports, JSONB columns, `public` schema tables.
