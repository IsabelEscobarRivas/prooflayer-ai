-- evaluations: human and AI review decisions on submissions
-- JSONB permitted on ai_result only — AI output is semi-structured.
-- All other fields are typed columns per ADR-001.

CREATE TABLE prooflayer.evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES prooflayer.organizations(id),
  submission_id   UUID NOT NULL REFERENCES prooflayer.submissions(id),
  assignment_id   UUID NOT NULL REFERENCES prooflayer.assignments(id),
  reviewer_id     UUID REFERENCES prooflayer.users(id),
  decision        TEXT CHECK (decision IN ('approved', 'rejected', 'needs_revision')),
  score           NUMERIC(5, 2),
  notes           TEXT,
  ai_model        TEXT,
  ai_result       JSONB,
  ai_evaluated_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON prooflayer.evaluations
  FOR EACH ROW EXECUTE FUNCTION prooflayer.set_updated_at();

CREATE INDEX ON prooflayer.evaluations(organization_id);
CREATE INDEX ON prooflayer.evaluations(submission_id);
CREATE INDEX ON prooflayer.evaluations(assignment_id);
CREATE INDEX ON prooflayer.evaluations(reviewer_id);
CREATE INDEX ON prooflayer.evaluations(decision);

GRANT ALL ON ALL TABLES IN SCHEMA prooflayer TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA prooflayer TO postgres, service_role;
