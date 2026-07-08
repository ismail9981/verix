"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface PopoverProps {
  /** Accessible name for the trigger button. */
  label: string;
  /** Trigger button contents (icon / avatar / text). */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Panel contents; receives a `close` callback. */
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  panelClassName?: string;
}

/* A small disclosure popover: an aria-expanded trigger controlling an
   animated panel. Closes on outside click and Escape (returning focus to
   the trigger). Shared by every header dropdown so the behavior — and its
   accessibility — is defined once. */
export function Popover({
  label,
  trigger,
  triggerClassName,
  children,
  align = "end",
  panelClassName,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const reduceMotion = useReducedMotion();

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName}
      >
        {trigger}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute z-50 mt-2 overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl shadow-black/40 ${
              align === "end" ? "right-0" : "left-0"
            } ${panelClassName ?? ""}`}
          >
            {children(close)}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
