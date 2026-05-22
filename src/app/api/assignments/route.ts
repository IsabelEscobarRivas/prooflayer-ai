import { NextRequest, NextResponse } from 'next/server';
import { validateAssignmentOrganization } from '@/lib/api/assignments';
import { appendAssignmentEvent, snapshotEvidenceRequirements } from '@/lib/api/operational';
import {
  dbUnavailableError,
  getSessionIdentity,
  mapPostgresError,
  requireRole,
} from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { organizationId } = session;

    const qcCaseId = req.nextUrl.searchParams.get('qc_case_id')?.trim();
    const assignedTo = req.nextUrl.searchParams.get('assigned_to')?.trim();
    const status = req.nextUrl.searchParams.get('status')?.trim();

    const db = getProoflayerDb();
    let query = db.from('assignments').select('*').eq('organization_id', organizationId);

    if (qcCaseId) query = query.eq('qc_case_id', qcCaseId);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    if (status) query = query.eq('status', status);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return dbUnavailableError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { userId, organizationId, userRole } = session;

    const forbidden = requireRole({ userId, organizationId, userRole }, 'field_worker');
    if (forbidden) return forbidden;

    const body = await req.json();
    const { qc_case_id, status, due_at } = body;

    if (!qc_case_id) {
      return NextResponse.json({ error: 'qc_case_id is required' }, { status: 400 });
    }

    const assigned_to = userId;
    const assigned_by = userId;

    const db = getProoflayerDb();
    const validation = await validateAssignmentOrganization(db, {
      organization_id: organizationId,
      qc_case_id,
      assigned_to,
      assigned_by,
    });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 422 });
    }

    const { data: created, error } = await db
      .from('assignments')
      .insert({
        organization_id: organizationId,
        qc_case_id,
        assigned_to,
        assigned_by,
        status: status ?? 'pending',
        due_at: due_at ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;

    const acceptedAt = new Date().toISOString();
    const { data: assignment, error: progressErr } = await db
      .from('assignments')
      .update({ status: 'in_progress', accepted_at: acceptedAt })
      .eq('id', created.id)
      .select('*')
      .single();

    if (progressErr) throw progressErr;

    await snapshotEvidenceRequirements(db, assignment);
    await appendAssignmentEvent(db, {
      organization_id: assignment.organization_id,
      assignment_id: assignment.id,
      event_type: 'accepted',
      from_status: 'pending',
      to_status: 'in_progress',
      actor_id: userId,
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    const mapped = mapPostgresError(err);
    if (mapped) return mapped;
    return dbUnavailableError(err);
  }
}
