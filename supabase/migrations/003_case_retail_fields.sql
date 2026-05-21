-- ADR-002 addendum: retail QC case fields
-- Additive columns on qc_cases — all nullable, no geo enforcement yet.
-- Do not modify 001_foundation.sql or 002_operational_shell.sql.

ALTER TABLE prooflayer.qc_cases
  ADD COLUMN store_name        TEXT,
  ADD COLUMN store_address     TEXT,
  ADD COLUMN item_name         TEXT,
  ADD COLUMN barcode_sku       TEXT,
  ADD COLUMN time_window_start TIMESTAMPTZ,
  ADD COLUMN time_window_end   TIMESTAMPTZ;
