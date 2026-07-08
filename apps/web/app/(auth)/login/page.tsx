import type { Metadata } from "next";
import { AuthCard } from "../../../components/auth/auth-card";
import { AuthHeader } from "../../../components/auth/auth-header";
import { LoginForm } from "../../../components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Verix account.",
};

export default function LoginPage() {
  return (
    <AuthCard>
      <AuthHeader title="Welcome back" subtitle="Sign in to your Verix account." />
      <div className="mt-8">
        <LoginForm />
      </div>
    </AuthCard>
  );
}
