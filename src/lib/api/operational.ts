import type { getProoflayerDb } from '@/lib/supabase/server';

type ProoflayerDb = ReturnType<typeof getProoflayerDb>;

type AssignmentRow = {
  id: string;
  organization_id: string;
  qc_case_id: string;
  assigned_to: string;
};

type TemplateRow = {
  id: string;
  kind: string;
  label: string;
  instructions: string | null;
  min_count: number;
  is_mandatory: boolean;
  sort_order: number;
};

export async function snapshotEvidenceRequirements(
  db: ProoflayerDb,
  assignment: AssignmentRow,
): Promise<void> {
  const { data: templates, error } = await db
    .from('case_evidence_templates')
    .select('id, kind, label, instructions, min_count, is_mandatory, sort_order')
    .eq('qc_case_id', assignment.qc_case_id);

  if (error) {
    console.error('snapshotEvidenceRequirements: failed to load templates', error);
    return;
  }

  if (!templates?.length) return;

  const rows = templates.map((t: TemplateRow) => ({
    organization_id: assignment.organization_id,
    assignment_id: assignment.id,
    case_evidence_template_id: t.id,
    kind: t.kind,
    label: t.label,
    instructions: t.instructions,
    min_count: t.min_count,
    is_mandatory: t.is_mandatory,
    sort_order: t.sort_order,
    status: 'pending',
  }));

  const { error: insertErr } = await db.from('assignment_evidence_requirements').insert(rows);
  if (insertErr) {
    console.error('snapshotEvidenceRequirements: failed to insert requirements', insertErr);
  }
}

export async function appendAssignmentEvent(
  db: ProoflayerDb,
  input: {
    organization_id: string;
    assignment_id: string;
    event_type: string;
    from_status: string | null;
    to_status: string;
    actor_id: string;
    reason?: string | null;
  },
): Promise<void> {
  const { error } = await db.from('assignment_events').insert({
    organization_id: input.organization_id,
    assignment_id: input.assignment_id,
    event_type: input.event_type,
    from_status: input.from_status,
    to_status: input.to_status,
    actor_id: input.actor_id,
    reason: input.reason ?? null,
  });

  if (error) {
    console.error('appendAssignmentEvent: failed to insert event', error);
  }
}
