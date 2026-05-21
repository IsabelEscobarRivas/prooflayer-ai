import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailableError, mapPostgresError, requireOrganizationId } from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const organizationId = requireOrganizationId(req.nextUrl.searchParams);
    if (organizationId instanceof NextResponse) return organizationId;

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
    const body = await req.json();
    const {
      organization_id,
      assignment_id,
      assignment_evidence_requirement_id,
      uploaded_by,
      storage_path,
      mime_type,
      byte_size,
      checksum,
      captured_at,
      upload_status,
    } = body;

    if (
      !organization_id ||
      !assignment_id ||
      !assignment_evidence_requirement_id ||
      !uploaded_by
    ) {
      return NextResponse.json(
        {
          error:
            'organization_id, assignment_id, assignment_evidence_requirement_id, and uploaded_by are required',
        },
        { status: 400 },
      );
    }

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('evidence_files')
      .insert({
        organization_id,
        assignment_id,
        assignment_evidence_requirement_id,
        uploaded_by,
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
