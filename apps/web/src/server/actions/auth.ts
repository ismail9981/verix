"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../auth/client";
import {
  loginSchema,
  resetRequestSchema,
  signUpSchema,
  updatePasswordSchema,
} from "../validators/auth";
import { zodFieldErrors, type FormActionResult } from "./action-result";

/*
 * Auth Server Actions. Each validates input, delegates to Supabase Auth through
 * the SSR server client (which sets/clears the session cookies), and returns
 * the shared typed result. The service-role key is never used here.
 */

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<FormActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check your details.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", message: "Invalid email or password." };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Signed in." };
}

export async function signUpAction(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<FormActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check your details.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
      data: { full_name: parsed.data.fullName },
    },
  });
  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "success", message: "Account created." };
}

export async function requestPasswordResetAction(input: {
  email: string;
}): Promise<FormActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check your details.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const origin = await siteOrigin();
  // Ignore the result deliberately: never reveal whether an email is registered.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  return { status: "success", message: "If that account exists, a link is on its way." };
}

export async function updatePasswordAction(input: {
  password: string;
}): Promise<FormActionResult> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check your details.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Password updated." };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
