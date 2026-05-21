import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailableError, mapPostgresError, requireOrganizationId } from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const organizationId = requireOrganizationId(req.nextUrl.searchParams);
    if (organizationId instanceof NextResponse) return organizationId;

    const assignmentId = req.nextUrl.searchParams.get('assignment_id')?.trim();
    const submissionId = req.nextUrl.searchParams.get('submission_id')?.trim();

    const db = getProoflayerDb();
    let query = db.from('evaluations').select('*').eq('organization_id', organizationId);

    if (assignmentId) query = query.eq('assignment_id', assignmentId);
    if (submissionId) query = query.eq('submission_id', submissionId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return dbUnavailableError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      organization_id,
      submission_id,
      assignment_id,
      reviewer_id,
      decision,
      score,
      notes,
      ai_model,
      ai_result,
      ai_evaluated_at,
    } = body;

    if (!organization_id || !submission_id || !assignment_id) {
      return NextResponse.json(
        { error: 'organization_id, submission_id, and assignment_id are required' },
        { status: 400 },
      );
    }

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('evaluations')
      .insert({
        organization_id,
        submission_id,
        assignment_id,
        reviewer_id: reviewer_id ?? null,
        decision: decision ?? null,
        score: score ?? null,
        notes: notes ?? null,
        ai_model: ai_model ?? null,
        ai_result: ai_result ?? null,
        ai_evaluated_at: ai_evaluated_at ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const mapped = mapPostgresError(err);
    if (mapped) return mapped;
    return dbUnavailableError(err);
  }
}
