import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailableError, mapPostgresError } from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TEMPLATE_IMMUTABLE = [
  'id',
  'created_at',
  'created_by',
  'organization_id',
  'qc_case_id',
] as const;

function rejectTemplateImmutableFields(body: Record<string, unknown>): NextResponse | null {
  for (const field of TEMPLATE_IMMUTABLE) {
    if (field in body) {
      return NextResponse.json(
        { error: `Field "${field}" cannot be updated` },
        { status: 400 },
      );
    }
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tid: string }> },
) {
  try {
    const { id: qcCaseId, tid } = await params;
    const body = await req.json();

    const immutable = rejectTemplateImmutableFields(body);
    if (immutable) return immutable;

    const updates: Record<string, unknown> = {};
    if ('label' in body) updates.label = body.label;
    if ('instructions' in body) updates.instructions = body.instructions;
    if ('min_count' in body) updates.min_count = body.min_count;
    if ('is_mandatory' in body) updates.is_mandatory = body.is_mandatory;
    if ('sort_order' in body) updates.sort_order = body.sort_order;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No mutable fields provided' }, { status: 400 });
    }

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('case_evidence_templates')
      .update(updates)
      .eq('id', tid)
      .eq('qc_case_id', qcCaseId)
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tid: string }> },
) {
  try {
    const { id: qcCaseId, tid } = await params;
    const db = getProoflayerDb();

    const { data: qcCase, error: caseErr } = await db
      .from('qc_cases')
      .select('status')
      .eq('id', qcCaseId)
      .maybeSingle();

    if (caseErr) throw caseErr;
    if (!qcCase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (qcCase.status !== 'draft') {
      return NextResponse.json(
        { error: 'Templates can only be deleted while case is in draft status' },
        { status: 400 },
      );
    }

    const { error } = await db
      .from('case_evidence_templates')
      .delete()
      .eq('id', tid)
      .eq('qc_case_id', qcCaseId);

    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const mapped = mapPostgresError(err);
    if (mapped) return mapped;
    return dbUnavailableError(err);
  }
}
