import { NextRequest, NextResponse } from 'next/server';
import {
  dbUnavailableError,
  getSessionIdentity,
  mapPostgresError,
  requireRole,
} from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { organizationId } = session;

    const assignmentId = req.nextUrl.searchParams.get('assignment_id')?.trim();

    const db = getProoflayerDb();
    let query = db.from('evidence_files').select('*').eq('organization_id', organizationId);

    if (assignmentId) {
      query = query.eq('assignment_id', assignmentId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return dbUnavailableError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionIdentity(req);
    if (session instanceof NextResponse) return session;
    const { userId, organizationId, userRole } = session;

    const forbidden = requireRole({ userId, organizationId, userRole }, 'field_worker');
    if (forbidden) return forbidden;

    const body = await req.json();
    const {
      assignment_id,
      assignment_evidence_requirement_id,
      storage_path,
      mime_type,
      byte_size,
      checksum,
      captured_at,
      upload_status,
    } = body;

    if (!assignment_id || !assignment_evidence_requirement_id) {
      return NextResponse.json(
        {
          error: 'assignment_id and assignment_evidence_requirement_id are required',
        },
        { status: 400 },
      );
    }

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('evidence_files')
      .insert({
        organization_id: organizationId,
        assignment_id,
        assignment_evidence_requirement_id,
        uploaded_by: userId,
        storage_path: storage_path ?? null,
        mime_type: mime_type ?? null,
        byte_size: byte_size ?? null,
        checksum: checksum ?? null,
        captured_at: captured_at ?? null,
        upload_status: upload_status ?? 'pending',
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
