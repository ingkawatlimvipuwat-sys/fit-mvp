import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Server client tied to the request's cookies. Use in route handlers and
 * server components for any operation that runs as the logged-in user.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch { /* read-only context */ }
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch { /* read-only context */ }
        },
      },
    }
  );
}

/**
 * Service-role client. BYPASSES RLS — never expose to the browser.
 * Use only for admin-style operations that the user can't do themselves.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // Next patches global fetch and caches GET responses in its Data Cache.
      // `export const dynamic = 'force-dynamic'` makes the ROUTE dynamic but
      // does not reliably opt these reads out, so the public shop pages served
      // a snapshot taken at the first request of the server's life: a retailer
      // could add a garment or a colour and never see it appear. Opting out
      // here covers every caller, which is the point — a per-query opt-out
      // would be one more thing to remember at each new call site.
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
      },
    }
  );
}
