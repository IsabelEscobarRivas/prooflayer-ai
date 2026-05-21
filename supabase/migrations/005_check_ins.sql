-- check_ins: field worker geo presence records
-- Append-only — no updated_at trigger.
-- Storage only in Phase 1.5B — no enforcement logic yet.

CREATE TABLE prooflayer.check_ins (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES prooflayer.organizations(id),
  assignment_id          UUID NOT NULL REFERENCES prooflayer.assignments(id),
  lat                    NUMERIC(10, 7) NOT NULL,
  lng                    NUMERIC(10, 7) NOT NULL,
  accuracy_m             NUMERIC(8, 2),
  distance_from_target_m NUMERIC(10, 2),
  geo_radius_m           INT,
  is_within_geofence     BOOLEAN,
  recorded_at            TIMESTAMPTZ NOT NULL,
  device_info            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON prooflayer.check_ins(organization_id);
CREATE INDEX ON prooflayer.check_ins(assignment_id);
CREATE INDEX ON prooflayer.check_ins(recorded_at);

GRANT ALL ON ALL TABLES IN SCHEMA prooflayer TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA prooflayer TO postgres, service_role;
