import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailableError, mapPostgresError, requireOrganizationId } from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const KINDS = ['photo', 'video', 'text', 'signature'] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const organizationId = requireOrganizationId(req.nextUrl.searchParams);
    if (organizationId instanceof NextResponse) return organizationId;

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
    const { id: qcCaseId } = await params;
    const body = await req.json();
    const { kind, label, created_by, instructions, min_count, is_mandatory, sort_order } =
      body;

    if (!kind || !label || !created_by) {
      return NextResponse.json(
        { error: 'kind, label, and created_by are required' },
        { status: 400 },
      );
    }

    if (!KINDS.includes(kind)) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }

    const db = getProoflayerDb();
    const { data: qcCase, error: caseErr } = await db
      .from('qc_cases')
      .select('organization_id')
      .eq('id', qcCaseId)
      .maybeSingle();

    if (caseErr) throw caseErr;
    if (!qcCase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data, error } = await db
      .from('case_evidence_templates')
      .insert({
        organization_id: qcCase.organization_id,
        qc_case_id: qcCaseId,
        kind,
        label,
        created_by,
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
