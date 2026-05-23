# ADR-003 — Phase 2 Production Readiness
**Status:** Accepted  
**Date:** 2026-05-21  
**Phase:** 2

## Context
Hardened the system from demo architecture to production-grade: 
real auth, session-derived identity, RLS, private storage, presigned 
uploads, evidence gating, geo gating, and three platform invariants.

## Platform Invariants
1. Append-Only Event Integrity — assignment_events never updated or 
   deleted. Enforced by Postgres trigger (migration 010).
2. Snapshot Immutability — snapshotted requirement fields immutable 
   after accept. Enforced by API route.
3. Evidence Row Reuse — same idempotency_key within 24h reuses 
   existing evidence_files row. Enforced by partial unique index.

## Key Decisions
- Auth: Supabase Auth + Next.js middleware JWT validation
- Identity: session-derived only — no body-supplied identity
- RLS: org_isolation policy on all 11 prooflayer tables
- Storage: prooflayer-evidence bucket, private, presigned PUT URLs
- Submission gates: geo pre-flight then evidence pre-flight
- Webhook: HMAC-SHA256 verification, always returns 200
- Engineering standard: no multi-step write without RPC or 
  explicit transaction

## Full Document
ProofLayer_ADR_003_v1_1_Phase2_APPROVED.docx
