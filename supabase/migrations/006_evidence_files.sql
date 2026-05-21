-- evidence_files: uploaded photo/video/document artifacts
-- Storage path placeholder — no Supabase Storage bucket wired yet.
-- Phase 2 adds presigned URL flow and actual file upload.

CREATE TABLE prooflayer.evidence_files (
  id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                     UUID NOT NULL REFERENCES prooflayer.organizations(id),
  assignment_id                       UUID NOT NULL REFERENCES prooflayer.assignments(id),
  assignment_evidence_requirement_id  UUID NOT NULL REFERENCES prooflayer.assignment_evidence_requirements(id),
  storage_path                        TEXT,
  mime_type                           TEXT,
  byte_size                           BIGINT,
  checksum                            TEXT,
  uploaded_by                         UUID NOT NULL REFERENCES prooflayer.users(id),
  upload_status                       TEXT NOT NULL DEFAULT 'pending'
                                        CHECK (upload_status IN (
                                          'pending', 'uploaded', 'verified', 'rejected'
                                        )),
  captured_at                         TIMESTAMPTZ,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON prooflayer.evidence_files
  FOR EACH ROW EXECUTE FUNCTION prooflayer.set_updated_at();

CREATE INDEX ON prooflayer.evidence_files(organization_id);
CREATE INDEX ON prooflayer.evidence_files(assignment_id);
CREATE INDEX ON prooflayer.evidence_files(assignment_evidence_requirement_id);
CREATE INDEX ON prooflayer.evidence_files(uploaded_by);
CREATE INDEX ON prooflayer.evidence_files(upload_status);

GRANT ALL ON ALL TABLES IN SCHEMA prooflayer TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA prooflayer TO postgres, service_role;
