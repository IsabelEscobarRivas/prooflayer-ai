import { getProoflayerDb } from '@/lib/supabase/server';

type ProoflayerDb = ReturnType<typeof getProoflayerDb>;

export type AssignmentOrgInput = {
  organization_id: string;
  qc_case_id: string;
  assigned_to: string;
  assigned_by: string;
};

export async function validateAssignmentOrganization(
  db: ProoflayerDb,
  input: AssignmentOrgInput,
): Promise<{ ok: true } | { ok: false; error: 'qc_case_not_found' | 'assignment_organization_mismatch' }> {
  const { data: qcCase, error: caseErr } = await db
    .from('qc_cases')
    .select('organization_id')
    .eq('id', input.qc_case_id)
    .maybeSingle();

  if (caseErr) throw caseErr;
  if (!qcCase) return { ok: false, error: 'qc_case_not_found' };

  const { data: assignee, error: assigneeErr } = await db
    .from('users')
    .select('organization_id')
    .eq('id', input.assigned_to)
    .maybeSingle();

  if (assigneeErr) throw assigneeErr;

  const { data: assigner, error: assignerErr } = await db
    .from('users')
    .select('organization_id')
    .eq('id', input.assigned_by)
    .maybeSingle();

  if (assignerErr) throw assignerErr;

  if (
    !assignee ||
    !assigner ||
    qcCase.organization_id !== input.organization_id ||
    assignee.organization_id !== input.organization_id ||
    assigner.organization_id !== input.organization_id
  ) {
    return { ok: false, error: 'assignment_organization_mismatch' };
  }

  return { ok: true };
}
