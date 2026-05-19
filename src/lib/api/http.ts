import { NextResponse } from 'next/server';

export const IMMUTABLE_FIELDS = ['id', 'created_at', 'created_by', 'organization_id'] as const;

export function requireOrganizationId(searchParams: URLSearchParams): string | NextResponse {
  const organizationId = searchParams.get('organization_id')?.trim();
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
  }
  return organizationId;
}

export function rejectImmutableFields(body: Record<string, unknown>): NextResponse | null {
  for (const field of IMMUTABLE_FIELDS) {
    if (field in body) {
      return NextResponse.json(
        { error: `Field "${field}" cannot be updated` },
        { status: 400 },
      );
    }
  }
  return null;
}

export function dbUnavailableError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : 'Database error';
  if (message.includes('NEXT_PUBLIC_SUPABASE_URL')) {
    return NextResponse.json({ error: message }, { status: 503 });
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

export function mapPostgresError(err: unknown): NextResponse | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { code?: string; message?: string };

  if (e.message?.includes('qc_case_not_found')) {
    return NextResponse.json({ error: 'qc_case_not_found' }, { status: 422 });
  }
  if (e.message?.includes('assignment_organization_mismatch')) {
    return NextResponse.json({ error: 'assignment_organization_mismatch' }, { status: 422 });
  }
  if (e.code === '23505') {
    return NextResponse.json({ error: 'Conflict: unique constraint violated' }, { status: 409 });
  }
  if (e.code === '23503') {
    return NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
  }
  return null;
}
