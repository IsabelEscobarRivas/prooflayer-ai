# ADR-001 — Phase 1 Foundation
**Status:** Accepted  
**Date:** 2026-05-19  
**Phase:** 1

## Context
Established the foundational schema, API, and UI for ProofLayer.
Defined the prooflayer schema, core tables, and API boundary.

## Key Decisions
- Schema: prooflayer (not public)
- Tables: organizations, users, qc_cases, assignments
- users.id mirrors auth.users.id (no DEFAULT) to enable future auth
- TEXT+CHECK enums — no Postgres enum types
- All tables: set_updated_at trigger, UUID PKs
- API uses service role client only — no client-side Supabase queries
- 13 route files covering organizations, users, qc_cases, assignments

## Full Document
ProofLayer_ADR_001_Phase1.docx
