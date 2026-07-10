"use client";

import {
  useCallback,
  useOptimistic,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@repo/ui";
import { CheckIcon } from "../../landing/icons";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { Reveal, RevealItem } from "../../landing/reveal";
import {
  updateBusinessProfileAction,
  type ProfileActionResult,
} from "../../../src/server/actions/workspace";
import { FieldInput } from "./field-input";
import { FieldSelect } from "./field-select";
import { CURRENCIES, LANGUAGES, TIMEZONES } from "./mock-data";
import { ProfileSection } from "./profile-section";
import { ProfileToast, type ToastState } from "./profile-toast";

export interface ProfileValues {
  name: string;
  slug: string;
  email: string;
  phone: string;
  website: string;
  timezone: string;
  currency: string;
  language: string;
  logoUrl: string;
  coverImageUrl: string;
}

interface BusinessProfileEditorProps {
  initialValues: ProfileValues;
}

const KEYS = [
  "name",
  "slug",
  "email",
  "phone",
  "website",
  "timezone",
  "currency",
  "language",
  "logoUrl",
  "coverImageUrl",
] as const;

export function BusinessProfileEditor({
  initialValues,
}: BusinessProfileEditorProps) {
  // `committed` = last server-confirmed state; `draft` = what's in the inputs.
  const [committed, setCommitted] = useState<ProfileValues>(initialValues);
  const [draft, setDraft] = useState<ProfileValues>(initialValues);
  // Optimistic preview: jumps to the draft on submit, auto-reverts on failure.
  const [optimistic, setOptimistic] = useOptimistic<ProfileValues, ProfileValues>(
    committed,
    (_current, next) => next,
  );
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string[]>>
  >({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  const dismissToast = useCallback(() => setToast(null), []);

  const set = (key: keyof ProfileValues, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const dirty = KEYS.some((key) => draft[key] !== committed[key]);
  const errorFor = (key: keyof ProfileValues) => fieldErrors[key]?.[0];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setOptimistic(draft);
      const result: ProfileActionResult =
        await updateBusinessProfileAction(formData);

      if (result.status === "success") {
        setCommitted(draft);
        setFieldErrors({});
        setToast({ tone: "success", message: result.message });
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setToast({ tone: "error", message: result.message });
      }
    });
  }

  function handleReset() {
    setDraft(committed);
    setFieldErrors({});
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="pb-28">
        <Reveal as="div" className="flex flex-col gap-10">
          <RevealItem as="div">
            <BrandPreview values={optimistic} pending={isPending} />
          </RevealItem>

          <ProfileSection
            id="company"
            title="Company information"
            description="Basic details about your business, shown to customers and on invoices."
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldInput
                label="Business name"
                name="name"
                required
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                error={errorFor("name")}
              />
              <FieldInput
                label="URL slug"
                name="slug"
                required
                value={draft.slug}
                onChange={(e) => set("slug", e.target.value)}
                error={errorFor("slug")}
                helperText="verix.app/your-slug"
              />
              <FieldInput
                label="Email"
                name="email"
                type="email"
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
                error={errorFor("email")}
              />
              <FieldInput
                label="Phone"
                name="phone"
                type="tel"
                value={draft.phone}
                onChange={(e) => set("phone", e.target.value)}
                error={errorFor("phone")}
              />
              <div className="sm:col-span-2">
                <FieldInput
                  label="Website"
                  name="website"
                  type="url"
                  placeholder="https://example.com"
                  value={draft.website}
                  onChange={(e) => set("website", e.target.value)}
                  error={errorFor("website")}
                />
              </div>
            </div>
          </ProfileSection>

          <ProfileSection
            id="localization"
            title="Localization"
            description="Regional defaults used across bookings, invoices, and reports."
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FieldSelect
                label="Timezone"
                name="timezone"
                options={TIMEZONES}
                value={draft.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              />
              <FieldSelect
                label="Currency"
                name="currency"
                options={CURRENCIES}
                value={draft.currency}
                onChange={(e) => set("currency", e.target.value)}
              />
              <FieldSelect
                label="Language"
                name="language"
                options={LANGUAGES}
                value={draft.language}
                onChange={(e) => set("language", e.target.value)}
              />
            </div>
          </ProfileSection>

          <ProfileSection
            id="branding"
            title="Branding"
            description="Logo and cover image for your public profile. Paste an image URL."
          >
            <div className="grid grid-cols-1 gap-5">
              <FieldInput
                label="Logo URL"
                name="logoUrl"
                type="url"
                placeholder="https://…/logo.png"
                value={draft.logoUrl}
                onChange={(e) => set("logoUrl", e.target.value)}
                error={errorFor("logoUrl")}
              />
              <FieldInput
                label="Cover image URL"
                name="coverImageUrl"
                type="url"
                placeholder="https://…/cover.jpg"
                value={draft.coverImageUrl}
                onChange={(e) => set("coverImageUrl", e.target.value)}
                error={errorFor("coverImageUrl")}
              />
            </div>
          </ProfileSection>
        </Reveal>

        <div className="sticky bottom-4 z-10 mt-8">
          <div className="flex items-center justify-end gap-3 rounded-xl border border-hairline bg-canvas/80 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-xl">
            <AnimatePresence>
              {dirty && !isPending ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mr-auto text-sm text-muted"
                >
                  Unsaved changes
                </motion.span>
              ) : null}
            </AnimatePresence>

            <Button
              type="button"
              className={CTA_SECONDARY}
              onClick={handleReset}
              disabled={!dirty || isPending}
            >
              Reset
            </Button>
            <Button
              type="submit"
              className={CTA_PRIMARY}
              loading={isPending}
              disabled={!dirty || isPending}
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </form>

      <ProfileToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}

/* Live brand preview driven by the optimistic values, so it updates the
   instant a save begins and reverts if the save fails. Uses background-image
   divs (not <img>) to render arbitrary user-supplied URLs safely. */
function BrandPreview({
  values,
  pending,
}: {
  values: ProfileValues;
  pending: boolean;
}) {
  const initials = values.name.trim().slice(0, 2).toUpperCase() || "?";

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface/40">
      <div
        className="relative h-28 bg-gradient-to-br from-accent/30 to-canvas bg-cover bg-center sm:h-36"
        style={
          values.coverImageUrl
            ? { backgroundImage: `url("${values.coverImageUrl}")` }
            : undefined
        }
        role="img"
        aria-label="Cover image preview"
      >
        {pending ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas/80 px-2.5 py-1 text-xs text-muted backdrop-blur">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Saving
          </span>
        ) : null}
      </div>
      <div className="-mt-8 flex items-center gap-4 px-5 pb-5">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-hairline bg-surface bg-cover bg-center text-lg font-semibold text-white shadow-lg shadow-black/30"
          style={
            values.logoUrl
              ? { backgroundImage: `url("${values.logoUrl}")` }
              : undefined
          }
          role="img"
          aria-label="Logo preview"
        >
          {values.logoUrl ? null : initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">
            {values.name.trim() || "Untitled workspace"}
          </p>
          <p className="truncate text-sm text-muted">
            verix.app/{values.slug || "your-slug"}
          </p>
        </div>
        <CheckIcon className="ml-auto hidden h-5 w-5 text-emerald-400/70 sm:block" />
      </div>
    </div>
  );
}
