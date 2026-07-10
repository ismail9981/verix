import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../../../src/server/auth/client";

/*
 * Email confirmation + password recovery landing route.
 *
 * Supabase emails link here with a `token_hash` and `type`. We verify the OTP
 * server-side (which establishes the session cookie) and forward the user on.
 * This backs both email verification (`type=signup`) and password reset
 * (`type=recovery`).
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  // Only allow same-app relative redirects.
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
}
