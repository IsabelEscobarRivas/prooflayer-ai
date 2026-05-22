import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailableError, getSessionIdentity, mapPostgresError } from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
    }

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('organizations')
      .insert({ name, slug })
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
