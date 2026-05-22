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
    if (id !== organizationId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const db = getProoflayerDb();
    const { data, error } = await db.from('organizations').select('*').eq('id', id).maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return dbUnavailableError(err);
  }
}
