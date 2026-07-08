"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "./icons";
import { HOME_HREF, LABEL_BY_HREF } from "./nav-config";
import type { Crumb } from "./types";

/** Title-cases an unknown slug, e.g. "website-builder" -> "Website Builder". */
function humanize(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* Derives the trail from the current path. Always rooted at Dashboard, then
   one crumb per path segment — so nested routes extend automatically. */
function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];

  if (segments[0] !== "dashboard") {
    crumbs.push({ label: "Dashboard", href: HOME_HREF, current: false });
  }

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    crumbs.push({
      label: LABEL_BY_HREF[href] ?? humanize(segment),
      href,
      current: index === segments.length - 1,
    });
  });

  return crumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            {index > 0 ? (
              <ChevronRightIcon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            ) : null}
            {crumb.current ? (
              <span aria-current="page" className="font-medium text-white">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
