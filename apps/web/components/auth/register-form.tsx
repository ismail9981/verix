"use client";

import { Button } from "@repo/ui";
import { AuthInput } from "./auth-input";
import { CTA_PRIMARY } from "../landing/cta-styles";
import { AuthAltAction } from "./auth-alt-action";
import { AuthDivider } from "./auth-divider";
import { AuthSuccess } from "./auth-success";
import { LockIcon, MailIcon, UserIcon } from "./icons";
import { SocialButtons } from "./social-buttons";
import { SubmitError } from "./submit-error";
import { useAuthForm } from "./use-auth-form";
import { email, matches, minLength, required } from "./validation";
import { signUpAction } from "../../src/server/actions/auth";

export function RegisterForm() {
  const form = useAuthForm(
    {
      fullName: [required("Name")],
      email: [required("Email"), email],
      password: [required("Password"), minLength(8)],
      confirmPassword: [
        required("Confirm password"),
        matches("password", "Passwords"),
      ],
    },
    async (values) => {
      const result = await signUpAction({
        fullName: values.fullName ?? "",
        email: values.email ?? "",
        password: values.password ?? "",
      });
      if (result.status === "error") throw new Error(result.message);
    },
  );

  if (form.isSuccess) {
    return (
      <AuthSuccess
        message="Your account has been created. Check your inbox to verify your email, then sign in to get started."
        actionHref="/login"
        actionLabel="Continue to sign in"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SocialButtons />
      <AuthDivider>or sign up with email</AuthDivider>

      <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-5">
        {form.submitError ? <SubmitError message={form.submitError} /> : null}

        <AuthInput
          label="Full name"
          type="text"
          name="fullName"
          autoComplete="name"
          placeholder="Jordan Rivera"
          leftIcon={<UserIcon className="h-4 w-4" />}
          value={form.values.fullName}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.fieldError("fullName")}
          disabled={form.isSubmitting}
          required
        />

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

        <AuthInput
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          leftIcon={<LockIcon className="h-4 w-4" />}
          value={form.values.password}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.fieldError("password")}
          helperText={
            form.fieldError("password") ? undefined : "Use 8 or more characters."
          }
          disabled={form.isSubmitting}
          required
        />

        <AuthInput
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="••••••••"
          leftIcon={<LockIcon className="h-4 w-4" />}
          value={form.values.confirmPassword}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.fieldError("confirmPassword")}
          disabled={form.isSubmitting}
          required
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          className={CTA_PRIMARY}
          loading={form.isSubmitting}
        >
          {form.isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <AuthAltAction
        prompt="Already have an account?"
        href="/login"
        label="Sign in"
      />
    </div>
  );
}
