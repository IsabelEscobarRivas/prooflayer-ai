-- ADR-003 §5.3 | Invariant 3 | Step 1
-- Adds idempotency_key to evidence_files to prevent duplicate upload rows.
-- Rollback: DROP INDEX evidence_files_idempotency_key_idx;
--           ALTER TABLE prooflayer.evidence_files DROP COLUMN idempotency_key;

ALTER TABLE prooflayer.evidence_files
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX evidence_files_idempotency_key_idx
  ON prooflayer.evidence_files(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
