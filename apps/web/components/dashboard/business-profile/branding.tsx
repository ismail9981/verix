import { FIELD_LABEL } from "./field-styles";
import { ImageIcon, UploadIcon } from "./icons";
import { BRAND_COLORS, PRIMARY_BRAND_COLOR } from "./mock-data";
import { ProfileSection } from "./profile-section";

/* Upload targets are placeholders (no backend) — real, focusable buttons for
   the premium look, wired to an uploader in a later sprint. */
function UploadZone({
  label,
  hint,
  className,
}: {
  label: string;
  hint: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-canvas/40 p-6 text-center transition-colors hover:border-accent/50 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className ?? ""}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <UploadIcon className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium text-white">{label}</span>
      <span className="text-xs text-muted">{hint}</span>
    </button>
  );
}

export function Branding() {
  return (
    <ProfileSection
      id="branding"
      title="Branding"
      description="Your logo, cover image, and brand color power your website, emails, and booking pages."
    >
      <div className="flex flex-col gap-6">
        <div>
          <p className={FIELD_LABEL}>Logo</p>
          <div className="mt-2 flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-hairline bg-canvas text-muted"
            >
              <ImageIcon className="h-6 w-6" />
            </span>
            <UploadZone
              label="Upload logo"
              hint="PNG or SVG, up to 2MB"
              className="flex-1"
            />
          </div>
        </div>

        <div>
          <p className={FIELD_LABEL}>Cover image</p>
          <UploadZone
            label="Upload cover image"
            hint="Recommended 1600 × 400px"
            className="mt-2 w-full"
          />
        </div>

        <div>
          <p className={FIELD_LABEL}>Brand color</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span
              aria-hidden="true"
              className="h-10 w-10 rounded-lg border border-white/10"
              style={{ backgroundColor: PRIMARY_BRAND_COLOR }}
            />
            <code className="font-mono text-sm text-white">{PRIMARY_BRAND_COLOR}</code>
            <span className="mx-1 h-6 w-px bg-hairline" />
            <ul className="flex items-center gap-2">
              {BRAND_COLORS.map((color) => (
                <li key={color}>
                  <span
                    title={color}
                    className={`block h-7 w-7 rounded-md border ${
                      color === PRIMARY_BRAND_COLOR
                        ? "border-white/60"
                        : "border-white/10"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </ProfileSection>
  );
}
