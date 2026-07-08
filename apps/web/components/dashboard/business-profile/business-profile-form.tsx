"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@repo/ui";
import { CheckIcon } from "../../landing/icons";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { Reveal } from "../../landing/reveal";
import { Branding } from "./branding";
import { BusinessDetails } from "./business-details";
import { BusinessHours } from "./business-hours";
import { CompanyInformation } from "./company-information";
import { Locations } from "./locations";
import { Services } from "./services";
import { SocialLinks } from "./social-links";
import { TaxSettings } from "./tax-settings";

/* Owns the page's save/cancel lifecycle. No backend: submit simulates a save
   (loading -> saved), and cancel resets the form by remounting the section
   tree (`formKey`), restoring every uncontrolled input and local toggle to
   its mock default. */
export function BusinessProfileForm() {
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const reduceMotion = useReducedMotion();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 1000);
  };

  const handleCancel = () => {
    setSaved(false);
    setFormKey((key) => key + 1);
  };

  return (
    <form onSubmit={handleSubmit} className="pb-24">
      <Reveal key={formKey} as="div" className="flex flex-col gap-10">
        <CompanyInformation />
        <Branding />
        <BusinessDetails />
        <BusinessHours />
        <Locations />
        <Services />
        <TaxSettings />
        <SocialLinks />
      </Reveal>

      <div className="sticky bottom-4 z-10 mt-8">
        <div className="flex items-center justify-end gap-3 rounded-xl border border-hairline bg-canvas/80 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-xl">
          <AnimatePresence>
            {saved ? (
              <motion.span
                initial={reduceMotion ? false : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="mr-auto inline-flex items-center gap-1.5 text-sm text-emerald-400"
              >
                <CheckIcon className="h-4 w-4" />
                All changes saved
              </motion.span>
            ) : null}
          </AnimatePresence>

          <Button type="button" className={CTA_SECONDARY} onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" className={CTA_PRIMARY} loading={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
