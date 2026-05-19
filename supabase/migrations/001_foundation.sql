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

-- ─── Supabase PostgREST: expose non-public schema ────────────────────────────
-- Required for any schema outside `public`. PostgREST only auto-exposes
-- `public`; custom schemas must be granted explicitly or the API returns 404.
GRANT USAGE ON SCHEMA prooflayer TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA prooflayer TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA prooflayer TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA prooflayer GRANT ALL ON TABLES TO postgres, service_role;
