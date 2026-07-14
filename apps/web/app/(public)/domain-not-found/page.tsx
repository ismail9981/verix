import { notFound } from "next/navigation";

/*
 * Rewrite target for a Host that classified as a public-site hostname but
 * didn't resolve to a live, published, eligible domain (unknown, unverified,
 * soft-deleted, or belonging to an unpublished site — proxy.ts doesn't
 * distinguish these to a visitor, so no hostname/workspace detail leaks).
 * Immediately defers to the co-located `not-found.tsx` for a real 404 status
 * with branded content — the idiomatic way to get both in the App Router.
 */
export default function DomainNotFoundPage() {
  notFound();
}
