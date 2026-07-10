"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckIcon } from "../../landing/icons";

export interface ToastState {
  tone: "success" | "error";
  message: string;
}

interface ProfileToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

/* Transient confirmation/error toast. Auto-dismisses; announced to assistive
   tech via role=status (success) or role=alert (error). `onDismiss` must be
   stable (useCallback) so the timer isn't reset on every parent render. */
export function ProfileToast({ toast, onDismiss }: ProfileToastProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 3500);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={`${toast.tone}-${toast.message}`}
            role={toast.tone === "error" ? "alert" : "status"}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={`pointer-events-auto inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg shadow-black/30 backdrop-blur-xl ${
              toast.tone === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            {toast.tone === "success" ? (
              <CheckIcon className="h-4 w-4 shrink-0" />
            ) : (
              <span aria-hidden="true" className="text-base leading-none">
                !
              </span>
            )}
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
