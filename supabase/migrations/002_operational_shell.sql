-- ADR-002: ProofLayer Phase 1.5B operational shell
-- Depends on 001_foundation.sql. Do not modify 001_foundation.sql.

-- ─── 1. case_evidence_templates (ADR-002 §3.1) ───────────────────────────────
CREATE TABLE prooflayer.case_evidence_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES prooflayer.organizations(id),
  qc_case_id      UUID NOT NULL REFERENCES prooflayer.qc_cases(id),
  kind            TEXT NOT NULL
                    CHECK (kind IN ('photo', 'video', 'text', 'signature')),
  label           TEXT NOT NULL,
  instructions    TEXT,
  min_count       INT NOT NULL DEFAULT 1,
  is_mandatory    BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES prooflayer.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON prooflayer.case_evidence_templates
  FOR EACH ROW EXECUTE FUNCTION prooflayer.set_updated_at();

-- ─── 2. assignment_evidence_requirements (ADR-002 §3.2) ────────────────────────
CREATE TABLE prooflayer.assignment_evidence_requirements (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES prooflayer.organizations(id),
  assignment_id             UUID NOT NULL REFERENCES prooflayer.assignments(id),
  case_evidence_template_id UUID NOT NULL REFERENCES prooflayer.case_evidence_templates(id),
  kind                      TEXT NOT NULL
                              CHECK (kind IN ('photo', 'video', 'text', 'signature')),
  label                     TEXT NOT NULL,
  instructions              TEXT,
  min_count                 INT NOT NULL DEFAULT 1,
  is_mandatory              BOOLEAN NOT NULL DEFAULT true,
  sort_order                INT NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'fulfilled', 'waived')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON prooflayer.assignment_evidence_requirements
  FOR EACH ROW EXECUTE FUNCTION prooflayer.set_updated_at();

-- ─── 3. submissions (ADR-002 §3.3) ───────────────────────────────────────────
CREATE TABLE prooflayer.submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES prooflayer.organizations(id),
  assignment_id   UUID NOT NULL UNIQUE REFERENCES prooflayer.assignments(id),
  submitted_by    UUID NOT NULL REFERENCES prooflayer.users(id),
  status          TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted', 'withdrawn')),
  notes           TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON prooflayer.submissions
  FOR EACH ROW EXECUTE FUNCTION prooflayer.set_updated_at();

-- ─── 4. assignment_events (ADR-002 §3.4) — append-only, no updated_at ───────
CREATE TABLE prooflayer.assignment_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES prooflayer.organizations(id),
  assignment_id   UUID NOT NULL REFERENCES prooflayer.assignments(id),
  event_type      TEXT NOT NULL
                    CHECK (event_type IN (
                      'accepted', 'started', 'submitted',
                      'approved', 'rejected', 'withdrawn'
                    )),
  from_status     TEXT,
  to_status       TEXT NOT NULL,
  actor_id        UUID NOT NULL REFERENCES prooflayer.users(id),
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 5. Changes to existing tables (ADR-002 §4) ──────────────────────────────
ALTER TABLE prooflayer.qc_cases
  ADD COLUMN instructions TEXT,
  ADD COLUMN due_at TIMESTAMPTZ,
  ADD COLUMN published_at TIMESTAMPTZ;

ALTER TABLE prooflayer.assignments
  ADD COLUMN accepted_at TIMESTAMPTZ,
  ADD COLUMN submitted_at TIMESTAMPTZ;

-- ─── 6. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX ON prooflayer.case_evidence_templates(organization_id);
CREATE INDEX ON prooflayer.case_evidence_templates(qc_case_id);
CREATE INDEX ON prooflayer.case_evidence_templates(created_by);

CREATE INDEX ON prooflayer.assignment_evidence_requirements(organization_id);
CREATE INDEX ON prooflayer.assignment_evidence_requirements(assignment_id);
CREATE INDEX ON prooflayer.assignment_evidence_requirements(case_evidence_template_id);
CREATE INDEX ON prooflayer.assignment_evidence_requirements(status);

CREATE INDEX ON prooflayer.submissions(organization_id);
CREATE INDEX ON prooflayer.submissions(submitted_by);
CREATE INDEX ON prooflayer.submissions(status);

CREATE INDEX ON prooflayer.assignment_events(organization_id);
CREATE INDEX ON prooflayer.assignment_events(assignment_id);
CREATE INDEX ON prooflayer.assignment_events(actor_id);

-- ─── 7. Supabase PostgREST: grants for new tables ────────────────────────────
GRANT ALL ON ALL TABLES IN SCHEMA prooflayer TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA prooflayer TO postgres, service_role;
