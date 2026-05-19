import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailableError, mapPostgresError, requireOrganizationId } from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const organizationId = requireOrganizationId(req.nextUrl.searchParams);
    if (organizationId instanceof NextResponse) return organizationId;

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    return dbUnavailableError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, organization_id, email, full_name, role } = body;

    if (!id || !organization_id || !email || !role) {
      return NextResponse.json(
        { error: 'id, organization_id, email, and role are required' },
        { status: 400 },
      );
    }

    if (role !== 'enterprise' && role !== 'field_worker') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('users')
      .insert({
        id,
        organization_id,
        email,
        full_name: full_name ?? null,
        role,
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
