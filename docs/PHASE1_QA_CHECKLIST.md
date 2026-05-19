# Phase 1 QA checklist (ADR-001 §11)

Run after migration + API implementation.

## Schema

- [ ] `prooflayer` schema exists; all four tables inside it
- [ ] `public` contains no ProofLayer application tables
- [ ] All PKs are UUID with `gen_random_uuid()` except `users.id` (no default)
- [ ] All tables have `created_at` / `updated_at` (timestamptz)
- [ ] `prooflayer.set_updated_at()` applied to all four tables
- [ ] `role` CHECK: `enterprise`, `field_worker`
- [ ] `qc_cases.status` CHECK: `draft`, `open`, `in_review`, `closed`
- [ ] `assignments.status` CHECK: `pending`, `in_progress`, `submitted`, `approved`, `rejected`
- [ ] `assignments.organization_id` NOT NULL FK → organizations
- [ ] No JSONB columns on Phase 1 tables
- [ ] No ENUM types in `prooflayer`
- [ ] All nine indexes from ADR §5 present
- [ ] Assignment org-consistency trigger rejects cross-org writes

## API

- [ ] `POST /api/assignments` rejects org mismatch (case vs assignee vs assignment)
- [ ] PATCH rejects `id`, `created_at`, `created_by`, `organization_id`
- [ ] All list endpoints require `organization_id`
- [ ] No cross-org rows returned
- [ ] Writes return full updated row

## Scope guard

- [ ] No evidence / storage / evaluations / assignment_events tables
- [ ] No `/upload`, `/evidence`, `/evaluate`, `/reports` routes
- [ ] No Gemini / OpenAI SDK imports
- [ ] No RLS policies on Phase 1 tables
