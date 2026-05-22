import { NextRequest, NextResponse } from 'next/server';
import { validateAssignmentOrganization } from '@/lib/api/assignments';
import {
  dbUnavailableError,
  getSessionIdentity,
  mapPostgresError,
  rejectImmutableFields,
} from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { organizationId } = session;

    const { id } = await params;
    const db = getProoflayerDb();
    const { data, error } = await db
      .from('assignments')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return dbUnavailableError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { organizationId } = session;

    const { id } = await params;
    const body = await req.json();

    const immutable = rejectImmutableFields(body);
    if (immutable) return immutable;

    const db = getProoflayerDb();
    const { data: existing, error: fetchErr } = await db
      .from('assignments')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const qc_case_id = (body.qc_case_id as string | undefined) ?? existing.qc_case_id;
    const assigned_to = (body.assigned_to as string | undefined) ?? existing.assigned_to;
    const assigned_by = (body.assigned_by as string | undefined) ?? existing.assigned_by;

    const validation = await validateAssignmentOrganization(db, {
      organization_id: organizationId,
      qc_case_id,
      assigned_to,
      assigned_by,
    });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 422 });
    }

    const updates: Record<string, unknown> = {};
    if ('qc_case_id' in body) updates.qc_case_id = body.qc_case_id;
    if ('assigned_to' in body) updates.assigned_to = body.assigned_to;
    if ('assigned_by' in body) updates.assigned_by = body.assigned_by;
    if ('status' in body) updates.status = body.status;
    if ('due_at' in body) updates.due_at = body.due_at;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No mutable fields provided' }, { status: 400 });
    }

    const { data, error } = await db
      .from('assignments')
      .update(updates)
      .eq('id', id)
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
