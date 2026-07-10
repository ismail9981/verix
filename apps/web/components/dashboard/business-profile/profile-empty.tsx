/* Shown when the database has no workspace yet (e.g. before seeding). Keeps
   the real feature graceful instead of crashing on empty data. */
export function ProfileEmpty() {
  return (
    <div className="rounded-2xl border border-hairline bg-surface/40 p-10 text-center">
      <h2 className="text-base font-semibold text-white">No workspace found</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        Your database is connected but has no workspace yet. Seed a demo
        workspace to start editing your business profile.
      </p>
      <code className="mt-4 inline-block rounded-lg border border-hairline bg-canvas px-3 py-1.5 text-xs text-muted">
        npm run db:seed --workspace web
      </code>
    </div>
  );
}
