import { RevealItem } from "../../landing/reveal";
import { TrashIcon } from "./icons";

/* Custom (non-ProfileSection) block so it can carry the red danger treatment
   while keeping the same two-column settings layout. */
export function DangerZone() {
  return (
    <RevealItem as="div">
      <section
        aria-labelledby="danger-heading"
        className="grid gap-x-8 gap-y-4 lg:grid-cols-3"
      >
        <div className="lg:col-span-1">
          <h2 id="danger-heading" className="text-sm font-semibold text-red-400">
            Danger zone
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Irreversible actions. Proceed with caution.
          </p>
        </div>
        <div className="lg:col-span-2">
          <div className="flex flex-col gap-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-sm font-medium text-white">Delete workspace</p>
              <p className="mt-0.5 text-sm text-muted">
                Permanently delete this workspace and all of its data.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <TrashIcon className="h-4 w-4" />
              Delete workspace
            </button>
          </div>
        </div>
      </section>
    </RevealItem>
  );
}
