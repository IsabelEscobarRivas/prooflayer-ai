import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailableError } from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getProoflayerDb();

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
