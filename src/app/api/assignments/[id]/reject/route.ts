import { NextRequest, NextResponse } from 'next/server';
import {
  dbUnavailableError,
  getSessionIdentity,
  mapPostgresError,
  requireRole,
} from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { userId, organizationId, userRole } = session;

    const forbidden = requireRole({ userId, organizationId, userRole }, 'enterprise');
    if (forbidden) return forbidden;

    const { id } = await params;
    const body = await req.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const db = getProoflayerDb();

    const { data: assignment, error: fetchErr } = await db
      .from('assignments')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (assignment.status !== 'submitted') {
      return NextResponse.json(
        { error: 'Assignment must be in submitted status to reject' },
        { status: 422 },
      );
    }

    const { data: updated, error: updateErr } = await db
      .from('assignments')
      .update({ status: 'rejected' })
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) throw updateErr;

    const { error: caseErr } = await db
      .from('qc_cases')
      .update({ status: 'open' })
      .eq('id', assignment.qc_case_id);

    if (caseErr) {
      console.error('[reject] Case status update failed after assignment rejected:', caseErr);
      return NextResponse.json(
        {
          error: 'partial_update_failed',
          message: 'Assignment rejected but case status update failed. Please retry.',
        },
        { status: 500 },
      );
    }

    const { error: eventErr } = await db.from('assignment_events').insert({
      organization_id: assignment.organization_id,
      assignment_id: id,
      event_type: 'rejected',
      from_status: 'submitted',
      to_status: 'rejected',
      actor_id: userId,
      reason: reason.trim(),
    });

    if (eventErr) throw eventErr;

    return NextResponse.json(updated);
  } catch (err) {
    const mapped = mapPostgresError(err);
    if (mapped) return mapped;
    return dbUnavailableError(err);
  }
}
