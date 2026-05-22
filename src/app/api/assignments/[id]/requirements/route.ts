import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailableError, getSessionIdentity } from '@/lib/api/http';
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

    const { data: assignment, error: assignErr } = await db
      .from('assignments')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (assignErr) throw assignErr;
    if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data, error } = await db
      .from('assignment_evidence_requirements')
      .select('*')
      .eq('assignment_id', id)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return dbUnavailableError(err);
  }
}
