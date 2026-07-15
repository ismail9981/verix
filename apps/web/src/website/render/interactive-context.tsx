"use client";

import { createContext, useContext, type ReactNode } from "react";

/*
 * Distinguishes the real public render (where a Contact form must actually
 * submit) from every other place the same `SectionView`/`SnapshotPageView`
 * renders the identical markup — the dashboard builder canvas, the
 * website-builder draft preview route, and template previews. Defaults to
 * `false` (fail-safe): a render path that forgets to opt in gets a
 * fully-styled, WYSIWYG form whose submit button is inert, rather than one
 * that can silently write a real lead while an owner is just designing.
 */
const InteractiveContext = createContext(false);

export function InteractiveProvider({
  interactive,
  children,
}: {
  interactive: boolean;
  children: ReactNode;
}) {
  return (
    <InteractiveContext.Provider value={interactive}>
      {children}
    </InteractiveContext.Provider>
  );
}

/** Whether the current render is the live public site (forms may submit for real). */
export function useSectionInteractive(): boolean {
  return useContext(InteractiveContext);
}
