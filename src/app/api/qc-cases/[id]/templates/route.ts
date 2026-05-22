import { NextRequest, NextResponse } from 'next/server';
import {
  dbUnavailableError,
  getSessionIdentity,
  mapPostgresError,
  requireRole,
} from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const KINDS = ['photo', 'video', 'text', 'signature'] as const;

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
      .from('case_evidence_templates')
      .select('*')
      .eq('qc_case_id', id)
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return dbUnavailableError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { userId, organizationId, userRole } = session;

    const forbidden = requireRole({ userId, organizationId, userRole }, 'enterprise');
    if (forbidden) return forbidden;

    const { id: qcCaseId } = await params;
    const body = await req.json();
    const { kind, label, instructions, min_count, is_mandatory, sort_order } = body;

    if (!kind || !label) {
      return NextResponse.json({ error: 'kind and label are required' }, { status: 400 });
    }

    if (!KINDS.includes(kind)) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }

    const db = getProoflayerDb();
    const { data: qcCase, error: caseErr } = await db
      .from('qc_cases')
      .select('organization_id')
      .eq('id', qcCaseId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (caseErr) throw caseErr;
    if (!qcCase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data, error } = await db
      .from('case_evidence_templates')
      .insert({
        organization_id: organizationId,
        qc_case_id: qcCaseId,
        kind,
        label,
        created_by: userId,
        instructions: instructions ?? null,
        min_count: min_count ?? 1,
        is_mandatory: is_mandatory ?? true,
        sort_order: sort_order ?? 0,
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
