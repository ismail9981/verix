import { Logo } from "../../../components/landing/logo";

/*
 * Branded 404 for a hostname that isn't currently serving a Verix site.
 * Deliberately generic — it never echoes back the requested hostname or any
 * workspace detail, so probing hostnames can't be used to learn whether one
 * belongs to another workspace.
 */
export default function DomainNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
      <Logo />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">
          This site isn&apos;t available
        </h1>
        <p className="max-w-md text-sm text-muted">
          The domain you&apos;re looking for isn&apos;t currently connected to a
          published Verix site.
        </p>
      </div>
    </div>
  );
}
