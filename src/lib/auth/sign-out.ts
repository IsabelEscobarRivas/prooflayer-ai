import { createBrowserClient } from '@/lib/supabase/client';

export async function signOut(): Promise<void> {
  const supabase = createBrowserClient();
  await supabase.auth.signOut();
  window.location.href = '/';
}
