import type { Metadata } from "next";
import { AuthCard } from "../../../components/auth/auth-card";
import { AuthHeader } from "../../../components/auth/auth-header";
import { RegisterForm } from "../../../components/auth/register-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Verix account and start building.",
};

export default function RegisterPage() {
  return (
    <AuthCard>
      <AuthHeader
        title="Create your account"
        subtitle="Start building your business platform for free."
      />
      <div className="mt-8">
        <RegisterForm />
      </div>
    </AuthCard>
  );
}
