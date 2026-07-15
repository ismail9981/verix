"use client";

import { useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useSectionInteractive } from "../../render/interactive-context";
import {
  CONTACT_SUBMISSION_FIELD_LIMITS,
  HONEYPOT_FIELD_NAME,
} from "../../../server/validators/lead-public";
import type { ContactFormConfig, ContactFormFieldKey } from "./schema";

/*
 * The public Contact form's interactive half (see `ContactPreview` in
 * `./index.tsx` for the static info card it's paired with). Only submits for
 * real when rendered on the live public site (`useSectionInteractive()`) —
 * everywhere else (dashboard builder canvas, draft preview, template
 * preview) it renders identically but the submit button is inert, so an
 * owner designing their site can never accidentally write a real lead.
 */

const FIELD_LABELS: Record<ContactFormFieldKey, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  subject: "Subject",
  message: "Message",
};

type Status = "idle" | "pending" | "success" | "error";

interface FormValues {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

const EMPTY_VALUES: FormValues = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
};

function fieldStyle(hasError: boolean): CSSProperties {
  return {
    width: "100%",
    borderRadius: "var(--wb-radius-md)",
    border: `1px solid ${hasError ? "var(--wb-color-danger)" : "var(--wb-color-border)"}`,
    background: "var(--wb-color-background)",
    color: "var(--wb-color-text)",
    padding: "10px 12px",
    fontSize: "14px",
    fontFamily: "var(--wb-font-body)",
  };
}

/** Resolves the siteId hint from the current path when the app isn't serving
 *  this page via a resolved custom hostname (see `route.ts`'s host fallback). */
function siteIdHintFromPath(pathname: string): string | undefined {
  const match = /^\/site\/([^/]+)/.exec(pathname);
  return match?.[1];
}

export function ContactFormWidget({
  formConfig,
  sectionId,
}: {
  formConfig: ContactFormConfig;
  sectionId: string;
}) {
  const interactive = useSectionInteractive();
  const statusId = useId();
  const startedAtRef = useRef(Date.now());

  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [honeypot, setHoneypot] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactFormFieldKey, string>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const enabledFields = (Object.keys(formConfig.fields) as ContactFormFieldKey[]).filter(
    (key) => formConfig.fields[key].enabled,
  );

  function setValue(key: ContactFormFieldKey, next: string) {
    setValues((prev) => ({ ...prev, [key]: next }));
  }

  function validate(): boolean {
    const errors: Partial<Record<ContactFormFieldKey, string>> = {};
    for (const key of enabledFields) {
      const cfg = formConfig.fields[key];
      const value = values[key].trim();
      if (cfg.required && !value) {
        errors[key] = `${FIELD_LABELS[key]} is required.`;
        continue;
      }
      if (key === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.email = "Enter a valid email address.";
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!interactive || status === "pending") return;
    if (!validate()) return;

    setStatus("pending");
    setMessage(null);

    try {
      const pathname = window.location.pathname;
      const locale = new URLSearchParams(window.location.search).get("locale") ?? undefined;
      const payload: Record<string, unknown> = {
        formKey: formConfig.formKey || sectionId,
        path: pathname,
        siteIdHint: siteIdHintFromPath(pathname),
        locale,
        honeypot,
        startedAt: startedAtRef.current,
      };
      for (const key of enabledFields) {
        payload[key] = values[key].trim();
      }

      const response = await fetch("/api/public/forms/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: { success?: boolean; message?: string; fieldErrors?: Record<string, string[]> } =
        await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setStatus("success");
        setMessage(formConfig.successMessage);
        setValues(EMPTY_VALUES);
        setHoneypot("");
      } else {
        setStatus("error");
        setMessage(data.message || "Something went wrong. Please try again.");
        if (data.fieldErrors) {
          const next: Partial<Record<ContactFormFieldKey, string>> = {};
          for (const [key, msgs] of Object.entries(data.fieldErrors)) {
            if (msgs?.[0]) next[key as ContactFormFieldKey] = msgs[0];
          }
          setFieldErrors(next);
        }
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          background: "var(--wb-color-surface)",
          border: "1px solid var(--wb-color-success)",
          borderRadius: "var(--wb-radius-lg)",
          padding: "var(--wb-container-padding)",
          color: "var(--wb-color-text)",
        }}
      >
        {message}
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      style={{
        background: "var(--wb-color-surface)",
        border: "1px solid var(--wb-color-border)",
        borderRadius: "var(--wb-radius-lg)",
        padding: "var(--wb-container-padding)",
        boxShadow: "var(--wb-shadow-md)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {formConfig.heading ? (
        <h3
          className="font-bold"
          style={{
            fontFamily: "var(--wb-font-heading)",
            fontSize: "calc(1.15rem * var(--wb-font-scale))",
            color: "var(--wb-color-text)",
          }}
        >
          {formConfig.heading}
        </h3>
      ) : null}
      {formConfig.description ? (
        <p style={{ color: "var(--wb-color-muted)", fontSize: "14px" }}>
          {formConfig.description}
        </p>
      ) : null}

      {/* Honeypot: off-screen (not display:none — some bots skip hidden
          inputs only when detected via that specific check), never focusable,
          hidden from assistive tech and autofill. */}
      <div
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <label htmlFor={`${statusId}-hp`}>Leave this field blank</label>
        <input
          id={`${statusId}-hp`}
          name={HONEYPOT_FIELD_NAME}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {enabledFields.map((key) => {
        const cfg = formConfig.fields[key];
        const fieldId = `${statusId}-${key}`;
        const error = fieldErrors[key];
        const commonProps = {
          id: fieldId,
          name: key,
          value: values[key],
          required: cfg.required,
          "aria-required": cfg.required,
          "aria-invalid": Boolean(error),
          "aria-describedby": error ? `${fieldId}-error` : undefined,
          style: fieldStyle(Boolean(error)),
        } as const;

        return (
          <div key={key} className="flex flex-col gap-1.5">
            <label
              htmlFor={fieldId}
              style={{ fontSize: "13px", color: "var(--wb-color-text)" }}
            >
              {FIELD_LABELS[key]}
              {cfg.required ? " *" : ""}
            </label>
            {key === "message" ? (
              <textarea
                {...commonProps}
                rows={4}
                maxLength={CONTACT_SUBMISSION_FIELD_LIMITS.message}
                onChange={(e) => setValue(key, e.target.value)}
              />
            ) : (
              <input
                {...commonProps}
                type={key === "email" ? "email" : "text"}
                maxLength={CONTACT_SUBMISSION_FIELD_LIMITS[key]}
                onChange={(e) => setValue(key, e.target.value)}
              />
            )}
            {error ? (
              <span
                id={`${fieldId}-error`}
                role="alert"
                style={{ fontSize: "12px", color: "var(--wb-color-danger)" }}
              >
                {error}
              </span>
            ) : null}
          </div>
        );
      })}

      <button
        type="submit"
        disabled={status === "pending" || !interactive}
        aria-busy={status === "pending"}
        style={{
          background: "var(--wb-button-bg)",
          color: "var(--wb-button-fg)",
          border: "1px solid var(--wb-button-border)",
          borderRadius: "var(--wb-button-radius)",
          padding: "var(--wb-button-padding)",
          fontSize: "var(--wb-button-font-size)",
          fontFamily: "var(--wb-font-body)",
          cursor: status === "pending" || !interactive ? "not-allowed" : "pointer",
          opacity: status === "pending" ? 0.7 : 1,
        }}
      >
        {status === "pending" ? "Sending…" : formConfig.submitLabel}
      </button>

      {!interactive ? (
        <p style={{ fontSize: "12px", color: "var(--wb-color-muted)" }}>
          Preview mode — submissions are disabled here.
        </p>
      ) : null}

      <div id={statusId} role="status" aria-live="polite" className="sr-only">
        {status === "pending" ? "Sending your message…" : ""}
        {status === "error" ? message : ""}
      </div>
    </form>
  );
}
