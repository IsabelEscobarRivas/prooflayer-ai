import { NextRequest, NextResponse } from 'next/server';
import {
  dbUnavailableError,
  getSessionIdentity,
  mapPostgresError,
  requireRole,
} from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { organizationId, userRole, userId } = session;

    const forbidden = requireRole({ userId, organizationId, userRole }, 'field_worker');
    if (forbidden) return forbidden;

    const body = await req.json();
    const {
      assignment_id,
      lat,
      lng,
      recorded_at,
      accuracy_m,
      distance_from_target_m,
      geo_radius_m,
      is_within_geofence,
      device_info,
    } = body;

    if (!assignment_id || lat == null || lng == null || !recorded_at) {
      return NextResponse.json(
        { error: 'assignment_id, lat, lng, and recorded_at are required' },
        { status: 400 },
      );
    }

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('check_ins')
      .insert({
        organization_id: organizationId,
        assignment_id,
        lat,
        lng,
        recorded_at,
        accuracy_m: accuracy_m ?? null,
        distance_from_target_m: distance_from_target_m ?? null,
        geo_radius_m: geo_radius_m ?? null,
        is_within_geofence: is_within_geofence ?? null,
        device_info: device_info ?? null,
      })
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
