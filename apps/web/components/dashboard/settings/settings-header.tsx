"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@repo/ui";
import { CheckIcon } from "../../landing/icons";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { PageHeader } from "../ui/page-header";

export function SettingsHeader() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const reduceMotion = useReducedMotion();

  const save = () => {
    if (saving) return;
    setSaved(false);
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 900);
  };

  return (
    <PageHeader
      title="Settings"
      subtitle="Manage your workspace, notifications, security, and integrations."
      actions={
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {saved ? (
              <motion.span
                initial={reduceMotion ? false : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5 text-sm text-emerald-400"
              >
                <CheckIcon className="h-4 w-4" />
                Saved
              </motion.span>
            ) : null}
          </AnimatePresence>
          <Button
            type="button"
            className={CTA_PRIMARY}
            loading={saving}
            onClick={save}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    />
  );
}
