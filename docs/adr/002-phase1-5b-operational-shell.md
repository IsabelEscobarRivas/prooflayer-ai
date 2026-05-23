# ADR-002 — Phase 1.5B Operational Shell
**Status:** Accepted  
**Date:** 2026-05-19  
**Phase:** 1.5B

## Context
Extended the schema with the operational workflow model: evidence 
templates, snapshotted requirements, submissions, and audit events.

## Key Decisions
- Snapshot at accept: case_evidence_templates copied to 
  assignment_evidence_requirements at assignment creation
- Two-table evidence model: templates (case-level) + requirements 
  (assignment-level snapshot)
- Reject returns case to open status
- New assignment required after reject — no resubmit on same row
- assignment_events is append-only — no UPDATE or DELETE
- 22 route files covering full operational workflow

## Full Document
ProofLayer_ADR_002_Phase1_5B.docx
