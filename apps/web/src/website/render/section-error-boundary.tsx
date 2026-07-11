"use client";

import { Component, type ReactNode } from "react";

/* Catches render-time errors thrown by a section component and shows the
   provided fallback, so one broken section never takes down the page. */
export class SectionErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
