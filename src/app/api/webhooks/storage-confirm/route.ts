import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'video/mp4',
]);

const MAX_BYTE_SIZE = 52_428_800; // 50MB

type StorageWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: {
    name?: string;
    [key: string]: unknown;
  };
};

function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/i, '').trim();

  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(provided, 'hex');
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return expected === provided;
  }
}

function parseEvidenceObjectPath(objectPath: string): {
  evidenceFileId: string | null;
} {
  const segments = objectPath.split('/').filter(Boolean);
  if (segments.length < 4 || segments[0] !== 'evidence') {
    return { evidenceFileId: null };
  }
  return { evidenceFileId: segments[3] ?? null };
}

async function findEvidenceFile(db: ReturnType<typeof getProoflayerDb>, objectPath: string) {
  const { data: byPath, error: pathErr } = await db
    .from('evidence_files')
    .select('*')
    .eq('storage_path', objectPath)
    .maybeSingle();

  if (pathErr) throw pathErr;
  if (byPath) return byPath;

  const { evidenceFileId } = parseEvidenceObjectPath(objectPath);
  if (!evidenceFileId) return null;

  const { data: byId, error: idErr } = await db
    .from('evidence_files')
    .select('*')
    .eq('id', evidenceFileId)
    .is('storage_path', null)
    .maybeSingle();

  if (idErr) throw idErr;
  return byId;
}

async function maybeFulfillRequirement(
  db: ReturnType<typeof getProoflayerDb>,
  requirementId: string,
) {
  const { data: requirement, error: reqErr } = await db
    .from('assignment_evidence_requirements')
    .select('id, min_count, status')
    .eq('id', requirementId)
    .maybeSingle();

  if (reqErr) throw reqErr;
  if (!requirement || requirement.status === 'fulfilled') return;

  const { count, error: countErr } = await db
    .from('evidence_files')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_evidence_requirement_id', requirementId)
    .eq('upload_status', 'verified');

  if (countErr) throw countErr;

  const minCount = (requirement.min_count as number) ?? 1;
  if ((count ?? 0) >= minCount) {
    const { error: updateErr } = await db
      .from('assignment_evidence_requirements')
      .update({
        status: 'fulfilled',
        fulfilled_at: new Date().toISOString(),
      })
      .eq('id', requirementId);

    if (updateErr) throw updateErr;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  try {
    const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET?.trim();
    const signature = req.headers.get('x-supabase-signature');

    if (webhookSecret) {
      if (!verifySignature(rawBody, signature, webhookSecret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      console.warn(
        '[storage-confirm] SUPABASE_WEBHOOK_SECRET is not set — skipping signature verification',
      );
    }

    let payload: StorageWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as StorageWebhookPayload;
    } catch {
      console.error('[storage-confirm] Invalid JSON payload');
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const objectPath = payload.record?.name?.trim();
    if (!objectPath) {
      console.error('[storage-confirm] Missing record.name in webhook payload');
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const db = getProoflayerDb();
    const evidenceFile = await findEvidenceFile(db, objectPath);

    if (!evidenceFile) {
      console.error('[storage-confirm] No evidence_files row for path:', objectPath);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (evidenceFile.upload_status === 'verified' || evidenceFile.upload_status === 'rejected') {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const now = new Date().toISOString();

    const { error: uploadedErr } = await db
      .from('evidence_files')
      .update({
        upload_status: 'uploaded',
        storage_path: objectPath,
        updated_at: now,
      })
      .eq('id', evidenceFile.id);

    if (uploadedErr) throw uploadedErr;

    const mimeType = evidenceFile.mime_type as string | null;
    const byteSize = evidenceFile.byte_size as number | null;

    const mimeValid = mimeType != null && ALLOWED_MIME_TYPES.has(mimeType);
    const sizeValid =
      byteSize != null && Number.isFinite(Number(byteSize)) && Number(byteSize) <= MAX_BYTE_SIZE;
    const isValid = mimeValid && sizeValid;
    const finalStatus = isValid ? 'verified' : 'rejected';

    const { error: statusErr } = await db
      .from('evidence_files')
      .update({
        upload_status: finalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', evidenceFile.id);

    if (statusErr) throw statusErr;

    if (isValid) {
      await maybeFulfillRequirement(
        db,
        evidenceFile.assignment_evidence_requirement_id as string,
      );
    } else {
      console.error('[storage-confirm] Validation failed', {
        evidence_file_id: evidenceFile.id,
        mime_type: mimeType,
        byte_size: byteSize,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[storage-confirm] Handler error:', err);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
