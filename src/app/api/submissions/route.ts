import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailableError, mapPostgresError } from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organization_id, assignment_id, submitted_by, notes } = body;

    if (!organization_id || !assignment_id || !submitted_by) {
      return NextResponse.json(
        { error: 'organization_id, assignment_id, and submitted_by are required' },
        { status: 400 },
      );
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

    if (assignment.organization_id !== organization_id) {
      return NextResponse.json({ error: 'assignment_organization_mismatch' }, { status: 422 });
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
        organization_id,
        assignment_id,
        submitted_by,
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
      organization_id,
      assignment_id,
      event_type: 'submitted',
      from_status: 'in_progress',
      to_status: 'submitted',
      actor_id: submitted_by,
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
