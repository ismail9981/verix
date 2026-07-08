import type { Metadata } from "next";
import { AuthCard } from "../../../components/auth/auth-card";
import { AuthHeader } from "../../../components/auth/auth-header";
import { ForgotPasswordForm } from "../../../components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset the password for your Verix account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard>
      <AuthHeader
        title="Forgot password?"
        subtitle="Enter your email and we'll send you a reset link."
      />
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
    </AuthCard>
  );
}
