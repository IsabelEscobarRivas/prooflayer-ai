import { NextRequest, NextResponse } from 'next/server';
import {
  dbUnavailableError,
  getSessionIdentity,
  mapPostgresError,
  rejectImmutableFields,
  requireRole,
} from '@/lib/api/http';
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
    const { data, error } = await db
      .from('qc_cases')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle();

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
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { organizationId, userRole, userId } = session;

    const forbidden = requireRole({ userId, organizationId, userRole }, 'enterprise');
    if (forbidden) return forbidden;

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
    if ('instructions' in body) updates.instructions = body.instructions;
    if ('due_at' in body) updates.due_at = body.due_at;
    if ('geo_lat' in body) updates.geo_lat = body.geo_lat;
    if ('geo_lng' in body) updates.geo_lng = body.geo_lng;
    if ('geo_radius_m' in body) updates.geo_radius_m = body.geo_radius_m;
    if ('priority' in body) updates.priority = body.priority;
    if ('external_ref' in body) updates.external_ref = body.external_ref;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No mutable fields provided' }, { status: 400 });
    }

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('qc_cases')
      .update(updates)
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
