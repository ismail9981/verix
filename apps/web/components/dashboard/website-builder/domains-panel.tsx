"use client";

import { Fragment, useState, useTransition, type FormEvent } from "react";
import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { CheckIcon } from "../../landing/icons";
import { SectionCard } from "../home/section-card";
import { Badge, type BadgeTone } from "../ui/badge";
import { RowActionsMenu } from "../ui/row-actions";
import { PlusIcon } from "../icons";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import {
  createDomainAction,
  deleteDomainAction,
  regenerateDomainVerificationTokenAction,
  setPrimaryDomainAction,
  verifyDomainAction,
} from "../../../src/server/actions/domain";
import {
  APP_DOMAIN,
  verificationRecordName,
  verificationRecordValue,
  type DomainListItem,
  type DomainStatus,
  type DomainType,
  type SslStatus,
} from "../../../src/server/validators/domain";
import type { Notify } from "./types";

const TYPE_OPTIONS = [
  { value: "subdomain", label: "Subdomain" },
  { value: "custom", label: "Custom domain" },
];

const STATUS_TONE: Record<DomainStatus, BadgeTone> = {
  active: "success",
  verified: "info",
  pending: "warning",
  failed: "danger",
};

const SSL_TONE: Record<SslStatus, BadgeTone> = {
  ready: "success",
  pending: "warning",
  not_requested: "neutral",
  failed: "danger",
};

const SSL_LABEL: Record<SslStatus, string> = {
  ready: "SSL ready",
  pending: "SSL pending",
  not_requested: "SSL not requested",
  failed: "SSL failed",
};

const TH = "px-5 py-2.5 font-medium";
const CELL = "px-5 py-3";

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

type VerificationUiState =
  | "verified"
  | "failed"
  | "transient_error"
  | "pending_configuration";

/*
 * Derived purely from stored fields: a transient DNS error is the only path
 * that leaves `status` at "pending" while also setting `verificationError`
 * (see decideVerificationOutcome in src/server/dns/verification.ts) — every
 * other pending domain has never been checked yet.
 */
function verificationUiState(domain: DomainListItem): VerificationUiState {
  if (domain.status === "verified" || domain.status === "active") return "verified";
  if (domain.status === "failed") return "failed";
  if (domain.verificationError) return "transient_error";
  return "pending_configuration";
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
      aria-hidden="true"
    >
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7" />
    </svg>
  );
}

/* Copies a fixed value to the clipboard with brief "Copied" feedback. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied by the browser; the value is still
      // selectable text, so this is a silent no-op rather than an error toast.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-emerald-400" />
      ) : (
        <CopyIcon className="h-4 w-4" />
      )}
    </button>
  );
}

function RecordField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-2.5 py-1.5">
        <code className="min-w-0 flex-1 truncate text-xs text-white">{value}</code>
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}

interface DomainVerificationDetailProps {
  siteId: string;
  domain: DomainListItem;
  isOwner: boolean;
  onNotify: Notify;
}

function DomainVerificationDetail({
  siteId,
  domain,
  isOwner,
  onNotify,
}: DomainVerificationDetailProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);

  const state = verificationUiState(domain);
  const token = domain.verificationToken;
  const recordName = verificationRecordName(domain.hostname);
  const recordValue = token ? verificationRecordValue(token) : null;

  function handleVerify() {
    startTransition(async () => {
      const result = await verifyDomainAction(siteId, domain.id);
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regenerateDomainVerificationTokenAction(
        siteId,
        domain.id,
      );
      setConfirmingRegenerate(false);
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  const verifyLabel = state === "verified" ? "Re-check verification" : "Verify domain";
  const retryLabel = "Retry verification";

  return (
    <div aria-busy={isPending} className="flex flex-col gap-4">
      {state !== "verified" && recordValue ? (
        <div>
          <p className="text-sm font-medium text-white">
            Add this DNS record to verify ownership
          </p>
          <p className="mt-0.5 text-xs text-muted">
            TXT records can take a few minutes to propagate after you save them.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted">Type</p>
              <div className="mt-1 rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-xs text-white">
                TXT
              </div>
            </div>
            <RecordField label="Name / Host" value={recordName} />
            <RecordField label="Value" value={recordValue} />
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {domain.verificationAttemptedAt ? (
          <span>Last checked {formatTimestamp(domain.verificationAttemptedAt)}</span>
        ) : (
          <span>Not checked yet</span>
        )}
        {state === "transient_error" && domain.verificationError ? (
          <span className="text-amber-400">{domain.verificationError}</span>
        ) : null}
        {state === "failed" && domain.verificationError ? (
          <span role="alert" className="text-red-400">
            {domain.verificationError}
          </span>
        ) : null}
        <Badge tone={SSL_TONE[domain.sslStatus]}>{SSL_LABEL[domain.sslStatus]}</Badge>
      </div>

      {isOwner ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className={CTA_SECONDARY}
            loading={isPending && !confirmingRegenerate}
            disabled={isPending}
            onClick={handleVerify}
          >
            {state === "failed" || state === "transient_error" ? retryLabel : verifyLabel}
          </Button>

          {confirmingRegenerate ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-xs text-amber-400">
                This invalidates the current token — confirm?
              </span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                loading={isPending}
                disabled={isPending}
                onClick={handleRegenerate}
              >
                Confirm regenerate
              </Button>
              <button
                type="button"
                onClick={() => setConfirmingRegenerate(false)}
                disabled={isPending}
                className="text-xs text-muted underline-offset-2 hover:text-white hover:underline"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRegenerate(true)}
              disabled={isPending}
              className="text-xs text-muted underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
            >
              Regenerate token
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">Only workspace owners can verify domains.</p>
      )}
    </div>
  );
}

interface DomainsPanelProps {
  siteId: string;
  siteName: string;
  domains: DomainListItem[];
  isOwner: boolean;
  onNotify: Notify;
}

export function DomainsPanel({
  siteId,
  siteName,
  domains,
  isOwner,
  onNotify,
}: DomainsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<DomainType>("subdomain");
  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("siteId", siteId);
    formData.set("type", type);
    formData.set("value", value);
    startTransition(async () => {
      const result = await createDomainAction(formData);
      if (result.status === "success") {
        setValue("");
        setFieldError(undefined);
      } else {
        setFieldError(result.fieldErrors?.value?.[0]);
      }
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function handleSetPrimary(domain: DomainListItem) {
    startTransition(async () => {
      const result = await setPrimaryDomainAction(siteId, domain.id);
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  function handleRemove(domain: DomainListItem) {
    startTransition(async () => {
      const result = await deleteDomainAction(domain.id);
      onNotify(result.status === "success" ? "success" : "error", result.message);
    });
  }

  return (
    <SectionCard id="domains" title={`Domains · ${siteName}`} bodyClassName="p-0">
      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-3 border-b border-hairline p-5"
      >
        <div className="w-40">
          <FieldSelect
            label="Type"
            name="type"
            options={TYPE_OPTIONS}
            value={type}
            onChange={(e) => setType(e.target.value as DomainType)}
          />
        </div>
        <div className="min-w-56 flex-1">
          <FieldInput
            label={type === "subdomain" ? "Subdomain" : "Custom domain"}
            name="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "subdomain" ? "my-site" : "example.com"}
            error={fieldError}
          />
          <p className="mt-1 text-xs text-muted">
            {type === "subdomain"
              ? `Will be added as ${value ? value : "<name>"}.${APP_DOMAIN}`
              : "Enter a domain you own — you'll verify ownership with a DNS record next."}
          </p>
        </div>
        <Button
          type="submit"
          size="sm"
          className={CTA_SECONDARY}
          loading={isPending}
          leftIcon={<PlusIcon className="h-4 w-4" />}
        >
          Add domain
        </Button>
      </form>

      {domains.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted">
          No domains yet. Add a subdomain or connect a custom domain.
        </p>
      ) : (
        <div
          aria-busy={isPending}
          className={`transition-opacity ${isPending ? "opacity-60" : ""}`}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">Domains</caption>
            <thead>
              <tr className="border-y border-hairline text-left text-xs text-muted">
                <th scope="col" className={TH}>Hostname</th>
                <th scope="col" className={`hidden sm:table-cell ${TH}`}>Type</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <Fragment key={domain.id}>
                  <tr className={domain.type === "custom" ? "border-b-0" : "border-b border-hairline last:border-0"}>
                    <td className={`${CELL} font-medium text-white`}>
                      <span className="flex items-center gap-2">
                        {domain.hostname}
                        {domain.isPrimary ? (
                          <Badge tone="accent">Primary</Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className={`${CELL} hidden text-muted sm:table-cell`}>
                      {domain.type === "subdomain" ? "Subdomain" : "Custom"}
                    </td>
                    <td className={CELL}>
                      <Badge tone={STATUS_TONE[domain.status]}>
                        {domain.status}
                      </Badge>
                    </td>
                    <td className={`${CELL} text-right`}>
                      <div className="flex justify-end">
                        {(() => {
                          const rowActions = [
                            ...(domain.isPrimary
                              ? []
                              : [
                                  {
                                    label: "Set as primary",
                                    onSelect: () => handleSetPrimary(domain),
                                  },
                                ]),
                            ...(isOwner
                              ? [
                                  {
                                    label: "Remove",
                                    danger: true,
                                    onSelect: () => handleRemove(domain),
                                  },
                                ]
                              : []),
                          ];
                          return rowActions.length > 0 ? (
                            <RowActionsMenu
                              label={`Actions for ${domain.hostname}`}
                              actions={rowActions}
                            />
                          ) : null;
                        })()}
                      </div>
                    </td>
                  </tr>
                  {domain.type === "custom" ? (
                    <tr className="border-b border-hairline last:border-0">
                      <td colSpan={4} className="bg-canvas/40 px-5 py-4">
                        <DomainVerificationDetail
                          siteId={siteId}
                          domain={domain}
                          isOwner={isOwner}
                          onNotify={onNotify}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
