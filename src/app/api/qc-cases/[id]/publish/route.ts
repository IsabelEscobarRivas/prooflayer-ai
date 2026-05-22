import { NextRequest, NextResponse } from 'next/server';
import {
  dbUnavailableError,
  getSessionIdentity,
  mapPostgresError,
  requireRole,
} from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { organizationId, userRole, userId } = session;

    const forbidden = requireRole({ userId, organizationId, userRole }, 'enterprise');
    if (forbidden) return forbidden;

    const { id } = await params;
    const db = getProoflayerDb();

    const { data: qcCase, error: caseErr } = await db
      .from('qc_cases')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (caseErr) throw caseErr;
    if (!qcCase) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (qcCase.status !== 'draft') {
      return NextResponse.json(
        { error: 'Case must be in draft status to publish' },
        { status: 400 },
      );
    }

    const { count, error: countErr } = await db
      .from('case_evidence_templates')
      .select('id', { count: 'exact', head: true })
      .eq('qc_case_id', id);

    if (countErr) throw countErr;
    if (!count || count < 1) {
      return NextResponse.json(
        { error: 'At least one evidence template is required to publish' },
        { status: 400 },
      );
    }

    const { data, error } = await db
      .from('qc_cases')
      .update({ status: 'open', published_at: new Date().toISOString() })
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
