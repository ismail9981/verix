import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/*
 * Edge-safe session refresh + route protection for middleware.
 *
 * Runs on every matched request: refreshes the Supabase auth cookies (so tokens
 * don't expire mid-session) and gates access. Uses only the public URL + anon
 * key and the request/response cookie stores — no Node APIs, no DB, no
 * service-role key — so it stays compatible with the Edge runtime.
 */

// URL prefixes that require an authenticated user.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/ai",
  "/analytics",
  "/bookings",
  "/business-profile",
  "/crm",
  "/payments",
  "/settings",
  "/team",
  "/website-builder",
];

// Auth pages a signed-in user should be bounced away from.
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

export async function updateSession(
  request: NextRequest,
  requestId: string,
): Promise<NextResponse> {
  // Forward the request id to downstream RSC/Server Actions via a request header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const forward = { request: { headers: requestHeaders } };

  let response = NextResponse.next(forward);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next(forward);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with Supabase (do not trust
  // getSession() alone in middleware).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
