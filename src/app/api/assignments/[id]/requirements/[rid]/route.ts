import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailableError, getSessionIdentity, mapPostgresError } from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const REQUIREMENT_IMMUTABLE = [
  'id',
  'created_at',
  'organization_id',
  'assignment_id',
  'case_evidence_template_id',
  'kind',
  'label',
  'instructions',
  'min_count',
  'is_mandatory',
  'sort_order',
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> },
) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { organizationId } = session;

    const { id: assignmentId, rid } = await params;
    const body = await req.json();

    for (const field of REQUIREMENT_IMMUTABLE) {
      if (field in body) {
        return NextResponse.json(
          { error: `Field "${field}" cannot be updated` },
          { status: 400 },
        );
      }
    }

    if (!('status' in body)) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    if (body.status !== 'waived') {
      return NextResponse.json(
        { error: 'Only status update to waived is allowed in Phase 1.5B' },
        { status: 400 },
      );
    }

    const db = getProoflayerDb();

    const { data: assignment, error: assignErr } = await db
      .from('assignments')
      .select('id')
      .eq('id', assignmentId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (assignErr) throw assignErr;
    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data, error } = await db
      .from('assignment_evidence_requirements')
      .update({ status: 'waived' })
      .eq('id', rid)
      .eq('assignment_id', assignmentId)
      .eq('organization_id', organizationId)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const mapped = mapPostgresError(err);
    if (mapped) return mapped;
    return dbUnavailableError(err);
  }
}
