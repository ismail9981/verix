"use client";

import { useEffect } from "react";

/* Root error boundary — the last line of defense. It replaces the whole document
   (must render <html>/<body>) when an error escapes the root layout, so it uses
   inline styles rather than the app's Tailwind/theme, which may not be available. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#fafafa",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#a1a1aa", margin: "0 0 20px" }}>
            An unexpected error occurred. Please try again.
            {error.digest ? ` (ref: ${error.digest})` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#6d5ef9",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
