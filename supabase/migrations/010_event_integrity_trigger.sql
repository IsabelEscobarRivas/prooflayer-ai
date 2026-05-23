-- ADR-003 | Invariant 1 | Step 16
-- Prevents UPDATE or DELETE on assignment_events (append-only guarantee)
-- Rollback: DROP TRIGGER prevent_event_modification ON prooflayer.assignment_events;
--           DROP FUNCTION prooflayer.prevent_event_modification();

CREATE OR REPLACE FUNCTION prooflayer.prevent_event_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'assignment_events are append-only and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_event_modification
  BEFORE UPDATE OR DELETE ON prooflayer.assignment_events
  FOR EACH ROW EXECUTE FUNCTION prooflayer.prevent_event_modification();
