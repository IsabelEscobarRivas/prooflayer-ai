import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  dbUnavailableError,
  getSessionIdentity,
  mapPostgresError,
  requireRole,
} from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'video/mp4',
] as const;

const EXPIRES_IN = 900;

function storagePath(organizationId: string, assignmentId: string, evidenceFileId: string): string {
  return `evidence/${organizationId}/${assignmentId}/${evidenceFileId}`;
}

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim();
  if (!url || !key || !bucket) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET are required.',
    );
  }
  return {
    supabase: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    bucket,
  };
}

async function createPresignedPutUrl(path: string) {
  const { supabase, bucket } = getStorageClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error) throw error;
  if (!data?.signedUrl) {
    throw new Error('Failed to generate presigned upload URL');
  }
  return data;
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
      assignment_evidence_requirement_id,
      mime_type,
      byte_size,
      idempotency_key,
    } = body as {
      assignment_evidence_requirement_id?: string;
      mime_type?: string;
      byte_size?: number;
      idempotency_key?: string;
    };

    if (!assignment_evidence_requirement_id || !mime_type || byte_size == null || !idempotency_key?.trim()) {
      return NextResponse.json(
        {
          error:
            'assignment_evidence_requirement_id, mime_type, byte_size, and idempotency_key are required',
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(mime_type as (typeof ALLOWED_MIME_TYPES)[number])) {
      return NextResponse.json({ error: 'Invalid mime_type' }, { status: 400 });
    }

    if (typeof byte_size !== 'number' || !Number.isFinite(byte_size) || byte_size <= 0) {
      return NextResponse.json({ error: 'byte_size must be a positive number' }, { status: 400 });
    }

    const db = getProoflayerDb();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: existing, error: existingErr } = await db
      .from('evidence_files')
      .select('*')
      .eq('idempotency_key', idempotency_key.trim())
      .eq('organization_id', organizationId)
      .gt('created_at', since)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existing && existing.upload_status !== 'expired') {
      const path =
        existing.storage_path ??
        storagePath(organizationId, existing.assignment_id as string, existing.id as string);
      const signed = await createPresignedPutUrl(path);
      return NextResponse.json(
        {
          evidence_file_id: existing.id,
          presigned_put_url: signed.signedUrl,
          path: signed.path,
          expires_in: EXPIRES_IN,
        },
        { status: 201 },
      );
    }

    const { data: requirement, error: reqErr } = await db
      .from('assignment_evidence_requirements')
      .select('id, assignment_id, organization_id')
      .eq('id', assignment_evidence_requirement_id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (reqErr) throw reqErr;
    if (!requirement) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
    }

    const assignmentId = requirement.assignment_id as string;

    const { data: row, error: insertErr } = await db
      .from('evidence_files')
      .insert({
        organization_id: organizationId,
        assignment_id: assignmentId,
        assignment_evidence_requirement_id,
        mime_type,
        byte_size,
        uploaded_by: userId,
        upload_status: 'pending',
        idempotency_key: idempotency_key.trim(),
        storage_path: null,
      })
      .select('*')
      .single();

    if (insertErr) throw insertErr;

    const path = storagePath(organizationId, assignmentId, row.id as string);
    const signed = await createPresignedPutUrl(path);

    return NextResponse.json(
      {
        evidence_file_id: row.id,
        presigned_put_url: signed.signedUrl,
        path: signed.path,
        expires_in: EXPIRES_IN,
      },
      { status: 201 },
    );
  } catch (err) {
    const mapped = mapPostgresError(err);
    if (mapped) return mapped;
    return dbUnavailableError(err);
  }
}
