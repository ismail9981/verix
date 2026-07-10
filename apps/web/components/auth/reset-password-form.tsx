"use client";

import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { AuthInput } from "./auth-input";
import { CTA_PRIMARY } from "../landing/cta-styles";
import { AuthSuccess } from "./auth-success";
import { LockIcon } from "./icons";
import { SubmitError } from "./submit-error";
import { useAuthForm } from "./use-auth-form";
import { matches, minLength, required } from "./validation";
import { updatePasswordAction } from "../../src/server/actions/auth";

/* Shown after a user follows a password-recovery link (which establishes a
   session via /auth/confirm). Sets a new password on the current session. */
export function ResetPasswordForm() {
  const router = useRouter();

  const form = useAuthForm(
    {
      password: [required("Password"), minLength(8)],
      confirmPassword: [
        required("Confirm password"),
        matches("password", "Passwords"),
      ],
    },
    async (values) => {
      const result = await updatePasswordAction({
        password: values.password ?? "",
      });
      if (result.status === "error") throw new Error(result.message);
      router.replace("/dashboard");
      router.refresh();
    },
  );

  if (form.isSuccess) {
    return (
      <AuthSuccess
        message="Your password has been updated. Taking you to your dashboard…"
        actionHref="/dashboard"
        actionLabel="Go to dashboard"
      />
    );
  }

  return (
    <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-5">
      {form.submitError ? <SubmitError message={form.submitError} /> : null}

      <AuthInput
        label="New password"
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
        {form.isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
