import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getProoflayerDb } from '@/lib/supabase/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/webhooks')) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getProoflayerDb();
    const { data: profile, error } = await db
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !profile) {
      return NextResponse.json({ error: 'Account not provisioned' }, { status: 403 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id);
    requestHeaders.set('x-organization-id', profile.organization_id);
    requestHeaders.set('x-user-role', profile.role);

    const nextResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
      nextResponse.cookies.set(name, value);
    });

    return nextResponse;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export const config = {
  matcher: ['/api/:path*'],
};
