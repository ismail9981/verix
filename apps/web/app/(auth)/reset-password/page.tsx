import type { Metadata } from "next";
import { AuthCard } from "../../../components/auth/auth-card";
import { AuthHeader } from "../../../components/auth/auth-header";
import { ResetPasswordForm } from "../../../components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Choose a new password for your Verix account.",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard>
      <AuthHeader
        title="Set a new password"
        subtitle="Choose a new password to finish resetting your account."
      />
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </AuthCard>
  );
}
