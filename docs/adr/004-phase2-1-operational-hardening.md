# ADR-004 — Phase 2.1 Operational Hardening
**Status:** Accepted  
**Date:** 2026-05-22  
**Phase:** 2.1

## Context
Hardening pass before Phase 3 AI/async complexity. Addresses 
transaction integrity, observability, automated testing, operational 
visibility, and error handling standards.

## Key Decisions
- Postgres RPC for POST /api/submissions (migration 011)
- Structured logger at src/lib/logger.ts with request ID propagation
- 15 named critical events logged across routes and webhook
- Vitest automated test suite with P0/P1 prioritization
- GET /api/admin/evidence-files for stuck upload visibility
- request_id in all error responses
- Six Phase 3 readiness gates — all must pass before Gemini work

## Phase 3 Readiness Gates
1. Transaction integrity
2. Observability  
3. Automated test suite
4. Operational visibility
5. Documentation completeness
6. Error handling completeness

## Full Document
ProofLayer_ADR_004_v1_1_Phase2_1_APPROVED.docx
