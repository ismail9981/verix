"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CloseIcon } from "./icons";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  ariaLabel: string;
  children: ReactNode;
}

/* Reusable right-side details drawer: overlay + sliding panel with a header,
   scrollable body, focus-to-close, Escape, and scroll lock. Shared across
   modules so the drawer behavior and accessibility live in one place. */
export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  ariaLabel,
  children,
}: DetailDrawerProps) {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={reduceMotion ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-hairline bg-canvas"
          >
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
                {subtitle ? (
                  <p className="truncate text-xs text-muted">{subtitle}</p>
                ) : null}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function DrawerSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </h3>
  );
}

export function DrawerField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-white">{children}</dd>
    </div>
  );
}
