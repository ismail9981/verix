import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./client";

/*
 * Reusable session helpers for server code (RSC, Server Actions, loaders).
 *
 * `getCurrentUser` is wrapped in React's `cache` so repeated calls within one
 * request hit Supabase only once. It uses `getUser()`, which revalidates the
 * JWT server-side rather than trusting the cookie blindly.
 */

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Returns the signed-in user, or redirects to /login when there is none. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export interface UserDisplay {
  name: string;
  email: string;
  initials: string;
}

/** Derive a small, serializable profile for the UI from an auth user. */
export function toUserDisplay(user: User): UserDisplay {
  const email = user.email ?? "";
  const metadata = user.user_metadata as { full_name?: string } | undefined;
  const name = metadata?.full_name?.trim() || email || "Account";
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?";
  return { name, email, initials };
}
