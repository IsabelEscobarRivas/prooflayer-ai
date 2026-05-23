import { NextRequest, NextResponse } from 'next/server';
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

    const assignmentId = req.nextUrl.searchParams.get('assignment_id')?.trim();

    const db = getProoflayerDb();
    let query = db.from('submissions').select('*').eq('organization_id', organizationId);

    if (assignmentId) {
      query = query.eq('assignment_id', assignmentId);
    }

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
    const { assignment_id, notes } = body;

    if (!assignment_id) {
      return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 });
    }

    const db = getProoflayerDb();

    const { data: assignment, error: assignErr } = await db
      .from('assignments')
      .select('*')
      .eq('id', assignment_id)
      .maybeSingle();

    if (assignErr) throw assignErr;
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    if (assignment.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Assignment must be in_progress to submit' },
        { status: 422 },
      );
    }

    if (assignment.organization_id !== organizationId) {
      return NextResponse.json({ error: 'assignment_organization_mismatch' }, { status: 422 });
    }

    // PRE-FLIGHT 1 — Geo gate (ADR-003 §6.1)
    const { data: qcCase, error: caseErr } = await db
      .from('qc_cases')
      .select('geo_lat, time_window_start, time_window_end')
      .eq('id', assignment.qc_case_id)
      .maybeSingle();

    if (caseErr) throw caseErr;
    if (!qcCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (qcCase.geo_lat != null) {
      let checkInQuery = db
        .from('check_ins')
        .select('id')
        .eq('assignment_id', assignment.id)
        .eq('is_within_geofence', true);

      if (qcCase.time_window_start) {
        checkInQuery = checkInQuery.gte('recorded_at', qcCase.time_window_start);
      }
      if (qcCase.time_window_end) {
        checkInQuery = checkInQuery.lte('recorded_at', qcCase.time_window_end);
      }

      const { data: validCheckIns, error: checkInErr } = await checkInQuery.limit(1);
      if (checkInErr) throw checkInErr;

      if (!validCheckIns?.length) {
        return NextResponse.json(
          {
            error: 'geo_checkin_required',
            message: 'A valid geo check-in within the time window is required',
          },
          { status: 422 },
        );
      }
    }

    // PRE-FLIGHT 2 — Evidence gate (ADR-003 §5.4)
    const { data: requirements, error: reqErr } = await db
      .from('assignment_evidence_requirements')
      .select('id, label, min_count, is_mandatory')
      .eq('assignment_id', assignment.id);

    if (reqErr) throw reqErr;

    const unmetRequirements: { id: string; label: string }[] = [];

    for (const requirement of requirements ?? []) {
      if (!requirement.is_mandatory) continue;

      const { count, error: countErr } = await db
        .from('evidence_files')
        .select('id', { count: 'exact', head: true })
        .eq('assignment_evidence_requirement_id', requirement.id)
        .eq('upload_status', 'verified');

      if (countErr) throw countErr;

      const minCount = (requirement.min_count as number) ?? 1;
      if ((count ?? 0) < minCount) {
        unmetRequirements.push({
          id: requirement.id as string,
          label: requirement.label as string,
        });
      }
    }

    if (unmetRequirements.length > 0) {
      return NextResponse.json(
        {
          error: 'mandatory_evidence_incomplete',
          message: 'All mandatory evidence must be verified before submission',
          unmet_requirements: unmetRequirements,
        },
        { status: 422 },
      );
    }

    const { data: existingSubmission, error: existingErr } = await db
      .from('submissions')
      .select('id')
      .eq('assignment_id', assignment_id)
      .maybeSingle();

    if (existingErr) throw existingErr;
    if (existingSubmission) {
      return NextResponse.json(
        { error: 'Submission already exists for this assignment' },
        { status: 409 },
      );
    }

    const submittedAt = new Date().toISOString();
    const { data: submission, error: insertErr } = await db
      .from('submissions')
      .insert({
        organization_id: organizationId,
        assignment_id,
        submitted_by: userId,
        notes: notes ?? null,
        submitted_at: submittedAt,
      })
      .select('*')
      .single();

    if (insertErr) throw insertErr;

    const { error: assignUpdateErr } = await db
      .from('assignments')
      .update({ status: 'submitted', submitted_at: submittedAt })
      .eq('id', assignment_id);

    if (assignUpdateErr) {
      return NextResponse.json(
        { error: `Submission created but assignment update failed: ${assignUpdateErr.message}` },
        { status: 500 },
      );
    }

    const { error: caseUpdateErr } = await db
      .from('qc_cases')
      .update({ status: 'in_review' })
      .eq('id', assignment.qc_case_id);

    if (caseUpdateErr) {
      return NextResponse.json(
        { error: `Submission created but case status update failed: ${caseUpdateErr.message}` },
        { status: 500 },
      );
    }

    const { error: eventErr } = await db.from('assignment_events').insert({
      organization_id: organizationId,
      assignment_id,
      event_type: 'submitted',
      from_status: 'in_progress',
      to_status: 'submitted',
      actor_id: userId,
    });

    if (eventErr) {
      return NextResponse.json(
        { error: `Submission created but event insert failed: ${eventErr.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    const mapped = mapPostgresError(err);
    if (mapped) return mapped;
    return dbUnavailableError(err);
  }
}
