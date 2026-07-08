"use client";

import Link from "next/link";
import { Button } from "@repo/ui";
import { AuthInput } from "./auth-input";
import { CTA_PRIMARY } from "../landing/cta-styles";
import { AuthAltAction } from "./auth-alt-action";
import { AuthDivider } from "./auth-divider";
import { AuthSuccess } from "./auth-success";
import { LockIcon, MailIcon } from "./icons";
import { signIn } from "./mock-auth";
import { SocialButtons } from "./social-buttons";
import { SubmitError } from "./submit-error";
import { useAuthForm } from "./use-auth-form";
import { email, required } from "./validation";

export function LoginForm() {
  const form = useAuthForm(
    {
      email: [required("Email"), email],
      password: [required("Password")],
    },
    (values) =>
      signIn({ email: values.email ?? "", password: values.password ?? "" }),
  );

  if (form.isSuccess) {
    return (
      <AuthSuccess
        message="You're signed in. Taking you to your dashboard…"
        actionHref="/"
        actionLabel="Go to dashboard"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SocialButtons />
      <AuthDivider>or continue with email</AuthDivider>

      <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-5">
        {form.submitError ? <SubmitError message={form.submitError} /> : null}

        <AuthInput
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@business.com"
          leftIcon={<MailIcon className="h-4 w-4" />}
          value={form.values.email}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.fieldError("email")}
          disabled={form.isSubmitting}
          required
        />

        <div>
          <AuthInput
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            leftIcon={<LockIcon className="h-4 w-4" />}
            value={form.values.password}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.fieldError("password")}
            disabled={form.isSubmitting}
            required
          />
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-accent underline-offset-4 hover:text-accent-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          className={CTA_PRIMARY}
          loading={form.isSubmitting}
        >
          {form.isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <AuthAltAction
        prompt="Don't have an account?"
        href="/register"
        label="Sign up"
      />
    </div>
  );
}
