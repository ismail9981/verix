/**
 * Thrown when a lookup finds no matching row for the given id — as opposed
 * to any other failure (a transient DB error, an unexpected exception).
 * Lets a caller (e.g. a page loader deciding whether to render Next.js's
 * `notFound()`) distinguish "this resource genuinely doesn't exist" from an
 * unexpected error that should propagate to the framework's error boundary
 * and get logged, instead of being silently swallowed as a 404.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
