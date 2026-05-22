-- ADR-003 §4 | Step 6
-- Enable row-level security and org-isolation policies on all prooflayer tables.
-- Rollback: DROP POLICY org_isolation ON each table; ALTER TABLE ... DISABLE ROW LEVEL SECURITY;

-- ─── organizations (no organization_id — match via user's org FK) ───────────
ALTER TABLE prooflayer.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON prooflayer.organizations
  USING (
    id = (
      SELECT organization_id FROM prooflayer.users
      WHERE id = auth.uid()
    )
  );

-- ─── users ───────────────────────────────────────────────────────────────────
ALTER TABLE prooflayer.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON prooflayer.users
  USING (
    organization_id = (
      SELECT organization_id FROM prooflayer.users
      WHERE id = auth.uid()
    )
  );

-- ─── qc_cases ────────────────────────────────────────────────────────────────
ALTER TABLE prooflayer.qc_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON prooflayer.qc_cases
  USING (
    organization_id = (
      SELECT organization_id FROM prooflayer.users
      WHERE id = auth.uid()
    )
  );

-- ─── assignments ─────────────────────────────────────────────────────────────
ALTER TABLE prooflayer.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON prooflayer.assignments
  USING (
    organization_id = (
      SELECT organization_id FROM prooflayer.users
      WHERE id = auth.uid()
    )
  );

-- ─── case_evidence_templates ─────────────────────────────────────────────────
ALTER TABLE prooflayer.case_evidence_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON prooflayer.case_evidence_templates
  USING (
    organization_id = (
      SELECT organization_id FROM prooflayer.users
      WHERE id = auth.uid()
    )
  );

-- ─── assignment_evidence_requirements ────────────────────────────────────────
ALTER TABLE prooflayer.assignment_evidence_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON prooflayer.assignment_evidence_requirements
  USING (
    organization_id = (
      SELECT organization_id FROM prooflayer.users
      WHERE id = auth.uid()
    )
  );

-- ─── submissions ─────────────────────────────────────────────────────────────
ALTER TABLE prooflayer.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON prooflayer.submissions
  USING (
    organization_id = (
      SELECT organization_id FROM prooflayer.users
      WHERE id = auth.uid()
    )
  );

-- ─── check_ins ───────────────────────────────────────────────────────────────
ALTER TABLE prooflayer.check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON prooflayer.check_ins
  USING (
    organization_id = (
      SELECT organization_id FROM prooflayer.users
      WHERE id = auth.uid()
    )
  );

-- ─── evidence_files ──────────────────────────────────────────────────────────
ALTER TABLE prooflayer.evidence_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON prooflayer.evidence_files
  USING (
    organization_id = (
      SELECT organization_id FROM prooflayer.users
      WHERE id = auth.uid()
    )
  );

-- ─── evaluations ─────────────────────────────────────────────────────────────
ALTER TABLE prooflayer.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON prooflayer.evaluations
  USING (
    organization_id = (
      SELECT organization_id FROM prooflayer.users
      WHERE id = auth.uid()
    )
  );

-- ─── assignment_events (read-only for client roles) ──────────────────────────
ALTER TABLE prooflayer.assignment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON prooflayer.assignment_events
  FOR SELECT
  USING (
    organization_id = (
      SELECT organization_id FROM prooflayer.users
      WHERE id = auth.uid()
    )
  );

-- ─── schema grants for authenticated role ────────────────────────────────────
GRANT USAGE ON SCHEMA prooflayer TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA prooflayer TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA prooflayer TO authenticated;
