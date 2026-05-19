-- ADR-001: ProofLayer Phase 1 foundation (prooflayer schema)
-- No seeds. No demo data. Apply on a new Supabase project.

-- ─── 1. Schema ───────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS prooflayer;

-- ─── 2. updated_at trigger function (applied to all Phase 1 tables) ──────────
CREATE OR REPLACE FUNCTION prooflayer.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 3. organizations ────────────────────────────────────────────────────────
CREATE TABLE prooflayer.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON prooflayer.organizations
  FOR EACH ROW EXECUTE FUNCTION prooflayer.set_updated_at();

-- ─── 4. users (id mirrors auth.users.id — no DEFAULT) ────────────────────────
CREATE TABLE prooflayer.users (
  id              UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES prooflayer.organizations(id),
  email           TEXT UNIQUE NOT NULL,
  full_name       TEXT,
  role            TEXT NOT NULL CHECK (role IN ('enterprise', 'field_worker')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON prooflayer.users
  FOR EACH ROW EXECUTE FUNCTION prooflayer.set_updated_at();

-- ─── 5. qc_cases ─────────────────────────────────────────────────────────────
CREATE TABLE prooflayer.qc_cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES prooflayer.organizations(id),
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'open', 'in_review', 'closed')),
  created_by      UUID NOT NULL REFERENCES prooflayer.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON prooflayer.qc_cases
  FOR EACH ROW EXECUTE FUNCTION prooflayer.set_updated_at();

-- ─── 6. assignments ──────────────────────────────────────────────────────────
CREATE TABLE prooflayer.assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES prooflayer.organizations(id),
  qc_case_id      UUID NOT NULL REFERENCES prooflayer.qc_cases(id),
  assigned_to     UUID NOT NULL REFERENCES prooflayer.users(id),
  assigned_by     UUID NOT NULL REFERENCES prooflayer.users(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'submitted', 'approved', 'rejected')),
  due_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON prooflayer.assignments
  FOR EACH ROW EXECUTE FUNCTION prooflayer.set_updated_at();

-- Org consistency enforcement (QA checklist — assignment cross-org guard)
CREATE OR REPLACE FUNCTION prooflayer.validate_assignment_org_consistency()
RETURNS TRIGGER AS $$
DECLARE
  case_org     UUID;
  assignee_org UUID;
  assigner_org UUID;
BEGIN
  SELECT organization_id INTO case_org     FROM prooflayer.qc_cases WHERE id = NEW.qc_case_id;
  SELECT organization_id INTO assignee_org FROM prooflayer.users    WHERE id = NEW.assigned_to;
  SELECT organization_id INTO assigner_org FROM prooflayer.users    WHERE id = NEW.assigned_by;

  IF case_org IS NULL THEN
    RAISE EXCEPTION 'qc_case_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM case_org
     OR assignee_org IS DISTINCT FROM NEW.organization_id
     OR assigner_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'assignment_organization_mismatch' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assignments_validate_org
  BEFORE INSERT OR UPDATE ON prooflayer.assignments
  FOR EACH ROW EXECUTE FUNCTION prooflayer.validate_assignment_org_consistency();

-- ─── 7. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX ON prooflayer.users(organization_id);
CREATE INDEX ON prooflayer.users(email);
CREATE INDEX ON prooflayer.qc_cases(organization_id);
CREATE INDEX ON prooflayer.qc_cases(created_by);
CREATE INDEX ON prooflayer.qc_cases(status);
CREATE INDEX ON prooflayer.assignments(organization_id);
CREATE INDEX ON prooflayer.assignments(qc_case_id);
CREATE INDEX ON prooflayer.assignments(assigned_to);
CREATE INDEX ON prooflayer.assignments(status);

-- ─── Supabase: expose schema to service role / PostgREST ─────────────────────
GRANT USAGE ON SCHEMA prooflayer TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA prooflayer TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA prooflayer TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA prooflayer GRANT ALL ON TABLES TO postgres, service_role;
