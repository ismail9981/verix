"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@repo/ui";
import { CheckIcon } from "../../landing/icons";
import { CTA_PRIMARY, CTA_SECONDARY } from "../../landing/cta-styles";
import { ExternalLinkIcon } from "./icons";

type Pending = "draft" | "publish" | null;

/* The Publish Panel: page heading plus the always-visible Preview / Save
   Draft / Publish actions. No backend — save/publish simulate a request and
   surface a transient confirmation. */
export function PublishHeader() {
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const run = (action: Exclude<Pending, null>, done: string) => {
    if (pending) return;
    setMessage(null);
    setPending(action);
    window.setTimeout(() => {
      setPending(null);
      setMessage(done);
    }, 1100);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Website Builder
        </h1>
        <p className="mt-1 text-sm text-muted">
          Design, edit, and publish your business website.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AnimatePresence>
          {message ? (
            <motion.span
              initial={reduceMotion ? false : { opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-1.5 text-sm text-emerald-400"
            >
              <CheckIcon className="h-4 w-4" />
              {message}
            </motion.span>
          ) : null}
        </AnimatePresence>

        <Button
          type="button"
          className={CTA_SECONDARY}
          leftIcon={<ExternalLinkIcon className="h-4 w-4" />}
        >
          Preview
        </Button>
        <Button
          type="button"
          className={CTA_SECONDARY}
          loading={pending === "draft"}
          onClick={() => run("draft", "Draft saved")}
        >
          {pending === "draft" ? "Saving…" : "Save draft"}
        </Button>
        <Button
          type="button"
          className={CTA_PRIMARY}
          loading={pending === "publish"}
          onClick={() => run("publish", "Published")}
        >
          {pending === "publish" ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}
