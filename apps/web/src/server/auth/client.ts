import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/*
 * Supabase server client (official @supabase/ssr approach).
 *
 * The session lives in HTTP cookies — never localStorage — and this client
 * reads/writes them through Next's cookie store, so Server Components, Server
 * Actions, and Route Handlers all share one authenticated session. It uses the
 * public URL + anon key only; the service-role key never touches this path.
 */

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` was called from a Server Component, where cookies are
            // read-only. Safe to ignore: the middleware refreshes the session.
          }
        },
      },
    },
  );
}
