import { NextRequest, NextResponse } from 'next/server';
import {
  dbUnavailableError,
  mapPostgresError,
  rejectImmutableFields,
} from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getProoflayerDb();
    const { data, error } = await db.from('qc_cases').select('*').eq('id', id).maybeSingle();

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
    const { id } = await params;
    const body = await req.json();

    const immutable = rejectImmutableFields(body);
    if (immutable) return immutable;

    const updates: Record<string, unknown> = {};
    if ('title' in body) updates.title = body.title;
    if ('description' in body) updates.description = body.description;
    if ('status' in body) updates.status = body.status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No mutable fields provided' }, { status: 400 });
    }

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('qc_cases')
      .update(updates)
      .eq('id', id)
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
