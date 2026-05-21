import { NextRequest, NextResponse } from 'next/server';
import { dbUnavailableError, mapPostgresError, requireOrganizationId } from '@/lib/api/http';
import { getProoflayerDb } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const organizationId = requireOrganizationId(req.nextUrl.searchParams);
    if (organizationId instanceof NextResponse) return organizationId;

    const status = req.nextUrl.searchParams.get('status')?.trim();
    const available = req.nextUrl.searchParams.get('available') === 'true';

    const db = getProoflayerDb();
    let query = db.from('qc_cases').select('*').eq('organization_id', organizationId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    let cases = data ?? [];

    if (available) {
      const { data: activeAssignments, error: assignErr } = await db
        .from('assignments')
        .select('qc_case_id')
        .eq('organization_id', organizationId)
        .neq('status', 'rejected');

      if (assignErr) throw assignErr;

      const claimedCaseIds = new Set(
        (activeAssignments ?? []).map((a) => a.qc_case_id as string),
      );
      cases = cases.filter((c) => !claimedCaseIds.has(c.id));
    }

    return NextResponse.json(cases);
  } catch (err) {
    return dbUnavailableError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      organization_id,
      title,
      description,
      instructions,
      due_at,
      store_name,
      store_address,
      item_name,
      barcode_sku,
      time_window_start,
      time_window_end,
      status,
      created_by,
    } = body;

    if (!organization_id || !title || !created_by) {
      return NextResponse.json(
        { error: 'organization_id, title, and created_by are required' },
        { status: 400 },
      );
    }

    const db = getProoflayerDb();
    const { data, error } = await db
      .from('qc_cases')
      .insert({
        organization_id,
        title,
        description: description ?? null,
        instructions: instructions ?? null,
        due_at: due_at ?? null,
        store_name: store_name ?? null,
        store_address: store_address ?? null,
        item_name: item_name ?? null,
        barcode_sku: barcode_sku ?? null,
        time_window_start: time_window_start ?? null,
        time_window_end: time_window_end ?? null,
        status: status ?? 'draft',
        created_by,
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
