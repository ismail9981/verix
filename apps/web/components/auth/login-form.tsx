"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@repo/ui";
import { AuthInput } from "./auth-input";
import { CTA_PRIMARY } from "../landing/cta-styles";
import { AuthAltAction } from "./auth-alt-action";
import { AuthDivider } from "./auth-divider";
import { AuthSuccess } from "./auth-success";
import { LockIcon, MailIcon } from "./icons";
import { SocialButtons } from "./social-buttons";
import { SubmitError } from "./submit-error";
import { useAuthForm } from "./use-auth-form";
import { email, required } from "./validation";
import { loginAction } from "../../src/server/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useAuthForm(
    {
      email: [required("Email"), email],
      password: [required("Password")],
    },
    async (values) => {
      const result = await loginAction({
        email: values.email ?? "",
        password: values.password ?? "",
      });
      if (result.status === "error") throw new Error(result.message);
      const redirectTo = searchParams.get("redirectTo");
      router.replace(redirectTo?.startsWith("/") ? redirectTo : "/dashboard");
      router.refresh();
    },
  );

  if (form.isSuccess) {
    return (
      <AuthSuccess
        message="You're signed in. Taking you to your dashboard…"
        actionHref="/dashboard"
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
