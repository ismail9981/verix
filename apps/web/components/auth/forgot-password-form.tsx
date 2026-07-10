"use client";

import { Button } from "@repo/ui";
import { AuthInput } from "./auth-input";
import { CTA_PRIMARY } from "../landing/cta-styles";
import { AuthAltAction } from "./auth-alt-action";
import { AuthSuccess } from "./auth-success";
import { MailIcon } from "./icons";
import { SubmitError } from "./submit-error";
import { useAuthForm } from "./use-auth-form";
import { email, required } from "./validation";
import { requestPasswordResetAction } from "../../src/server/actions/auth";

export function ForgotPasswordForm() {
  const form = useAuthForm(
    { email: [required("Email"), email] },
    async (values) => {
      const result = await requestPasswordResetAction({
        email: values.email ?? "",
      });
      if (result.status === "error") throw new Error(result.message);
    },
  );

  if (form.isSuccess) {
    return (
      <AuthSuccess
        message={`If an account exists for ${form.values.email}, a password reset link is on its way.`}
        actionHref="/login"
        actionLabel="Back to sign in"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
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

        <Button
          type="submit"
          size="lg"
          fullWidth
          className={CTA_PRIMARY}
          loading={form.isSubmitting}
        >
          {form.isSubmitting ? "Sending link…" : "Send reset link"}
        </Button>
      </form>

      <AuthAltAction
        prompt="Remembered your password?"
        href="/login"
        label="Back to sign in"
      />
    </div>
  );
}
