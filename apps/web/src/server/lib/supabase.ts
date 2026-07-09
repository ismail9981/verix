import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

/*
 * Server-side Supabase client.
 *
 * Uses the service-role key, which bypasses Row Level Security. It must only
 * ever be imported from server code — never bundled into the browser. Session
 * persistence and token refresh are disabled since this client acts on behalf
 * of the server, not a signed-in user. (Auth flows themselves are a later
 * phase; this only configures the client.)
 */

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
