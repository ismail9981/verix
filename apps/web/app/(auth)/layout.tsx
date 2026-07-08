import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthBrandPanel } from "../../components/auth/auth-brand-panel";

/* Shared shell for every auth route: a split layout with a marketing panel
   on the left (desktop) and the centered form on the right. The title
   template lets each page set just its own name (e.g. "Sign in · Verix"). */
export const metadata: Metadata = {
  title: {
    default: "Verix",
    template: "%s · Verix",
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-2">
      <AuthBrandPanel />
      <main className="flex items-center justify-center px-6 py-12 sm:py-16">
        {children}
      </main>
    </div>
  );
}
