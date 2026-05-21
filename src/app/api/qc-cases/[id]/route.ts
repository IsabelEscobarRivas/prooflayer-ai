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
    if ('store_name' in body) updates.store_name = body.store_name;
    if ('store_address' in body) updates.store_address = body.store_address;
    if ('item_name' in body) updates.item_name = body.item_name;
    if ('barcode_sku' in body) updates.barcode_sku = body.barcode_sku;
    if ('time_window_start' in body) updates.time_window_start = body.time_window_start;
    if ('time_window_end' in body) updates.time_window_end = body.time_window_end;

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
