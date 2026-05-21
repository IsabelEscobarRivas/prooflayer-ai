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
    const { data, error } = await db.from('evaluations').select('*').eq('id', id).maybeSingle();

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
    if ('reviewer_id' in body) updates.reviewer_id = body.reviewer_id;
    if ('decision' in body) updates.decision = body.decision;
    if ('score' in body) updates.score = body.score;
    if ('notes' in body) updates.notes = body.notes;
    if ('ai_model' in body) updates.ai_model = body.ai_model;
    if ('ai_result' in body) updates.ai_result = body.ai_result;
    if ('ai_evaluated_at' in body) updates.ai_evaluated_at = body.ai_evaluated_at;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No mutable fields provided' }, { status: 400 });
    }

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('evaluations')
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
