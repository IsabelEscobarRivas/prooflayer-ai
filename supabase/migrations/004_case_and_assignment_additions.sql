-- ADR addendum: case, assignment, and submission field completions
-- All additive. No existing columns modified.
-- Do not modify 001, 002, or 003.

-- qc_cases additions
ALTER TABLE prooflayer.qc_cases
  ADD COLUMN geo_lat      NUMERIC(10, 7),
  ADD COLUMN geo_lng      NUMERIC(10, 7),
  ADD COLUMN geo_radius_m INT,
  ADD COLUMN priority     TEXT NOT NULL DEFAULT 'normal'
                            CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN external_ref TEXT;

-- assignments additions
ALTER TABLE prooflayer.assignments
  ADD COLUMN completed_at TIMESTAMPTZ;

-- assignment_evidence_requirements additions
ALTER TABLE prooflayer.assignment_evidence_requirements
  ADD COLUMN fulfilled_at TIMESTAMPTZ,
  ADD COLUMN waived_by    UUID REFERENCES prooflayer.users(id),
  ADD COLUMN waived_at    TIMESTAMPTZ;

-- submissions additions
ALTER TABLE prooflayer.submissions
  ADD COLUMN reviewed_by   UUID REFERENCES prooflayer.users(id),
  ADD COLUMN reviewed_at   TIMESTAMPTZ,
  ADD COLUMN review_notes  TEXT;

-- case_evidence_templates additions
ALTER TABLE prooflayer.case_evidence_templates
  ADD COLUMN ai_evaluation_hint TEXT;
