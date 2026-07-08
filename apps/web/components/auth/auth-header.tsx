import Link from "next/link";
import { Logo } from "../landing/logo";

interface AuthHeaderProps {
  title: string;
  subtitle: string;
}

/* Card header. The logo shows only below `lg` — on desktop the brand panel
   already carries it. The title is the page's single <h1>. */
export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        aria-label="Verix home"
        className="inline-flex w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
      >
        <Logo />
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>
    </div>
  );
}
